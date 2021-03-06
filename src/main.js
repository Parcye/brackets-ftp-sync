/*
 * Copyright (c) 2013-2014 Tim Burgess. All rights reserved.
 *
 * @author Tim Burgess <info@tim-burgess.com>
 * @license Tim Burgess 2014
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, browser: true, white:true */
/*global $, define, Mustache, brackets, debugger */

define(function (require, exports, module) {
    "use strict";

    var COMMAND_ID = "timburgess.ftpsync";
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        FileSystem          = brackets.getModule("filesystem/FileSystem"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        Strings             = brackets.getModule("strings");

    
    var mainDialog       = require("text!htmlContent/ftp-dialog.html");
    var toolbar          = require("text!htmlContent/ftp-toolbar.html");

    var nodeConnection;
    
    var inProcess = false; // whether ftp is underway
    
    var ftpSettings = {
        host : "localhost",
        port : "21",
        user : "",
        pwd : "",
        savepwd: "",
        localRoot : "",
        remoteRoot : ""
    };


    // save settings used in dialog so we can populate future dialogs
    // password is never saved
    function saveSettings() {
        
        var projectRoot = ProjectManager.getProjectRoot().fullPath;
        var file = FileSystem.getFileForPath(projectRoot + '.ftpsync_settings');

        function replacePwd(key, value) {
            if (key === "pwd") return undefined;
            return value;
        }
        // if save password is checked, no need to remove pwd from settings
        if (ftpSettings.savepwd == 'checked') {
        	FileUtils.writeText(file, JSON.stringify(ftpSettings));
        } else {
        	FileUtils.writeText(file, JSON.stringify(ftpSettings, replacePwd));
        }
    }
    
    // pull saved dialog settings from .ftpsync_settings in project root
    function readSettings() {
        
        var destinationDir = ProjectManager.getProjectRoot().fullPath;
        FileSystem.resolve(destinationDir + ".ftpsync_settings", function (err, fileEntry) {
            if (!err) {
                FileUtils.readAsText(fileEntry).done(function (text) {
                    // settings file exists so parse
                    console.log('parsed .ftpsync_settings');
                    ftpSettings = $.parseJSON(text);
                });
            } else {
                console.log("no existing ftp settings");
            }
        });
    }
    
    // handle Upload button
    function handleOk() {

        // get input values and save settings
        var $dlg = $(".ftp-dialog.instance");
        ftpSettings.host = $dlg.find("#host").val();
        ftpSettings.port = $dlg.find("#port").val();
        ftpSettings.user = $dlg.find("#user").val();
        ftpSettings.pwd = $dlg.find("#pwd").val();
        ftpSettings.savepwd = $dlg.find("#savepwd:checked").val();
        ftpSettings.remoteRoot = $dlg.find("#remoteroot").val();

        saveSettings();
        
        // determine the local root
        ftpSettings.localRoot = ProjectManager.getProjectRoot().fullPath;
        
        // emit a connecting event for dialog status
        handleEvent({ namespace: "connecting" }, "Connecting..." );

        // call ftp upload
        inProcess = true;
        callFtpUpload();
        
        // dialog closes on receipt of disconnect event
    }
        
    // handle cancel button
    function handleCancel() {
        
        if (inProcess) { // if ftp underway, call cancel on node-side
            callFtpStop();
            inProcess = false;
        } else { // dialog will close on disconnect event
            Dialogs.cancelModalDialogIfOpen("ftp-dialog");
        }
    }
    
    // general event handler of node-side events
    function handleEvent(event, msg) {
        
        var $dlg = $(".ftp-dialog.instance");

        if (event.namespace === "error") {
            // remove spinner if active
            $dlg.find(".spinner").removeClass("spin");
            $dlg.find("#status").html(msg);
            inProcess = false;
            return;
        }
            
        if (event.namespace === "connecting") {
            //start spinner
            $dlg.find(".spinner").addClass("spin");
        } else if (event.namespace === "disconnected") {
            //stop spinner
            $dlg.find(".spinner").removeClass("spin");
            inProcess = false;
        }            
        var $status = $dlg.find("#status");
        msg.split('\n').forEach(function (line) {
            if (line.length > 61) {
                line = line.substr(0,61) + "..";
            }
            $status.html(line);
        });
        
        // close dialog on disconnect
        if (event.namespace === "disconnected") {
            Dialogs.cancelModalDialogIfOpen("ftp-dialog");
        }
    }


    
    // show the ftp dialog and get references    
    function showFtpDialog() {

        var templateVars = {
            host: ftpSettings.host,
            port: ftpSettings.port,
            user: ftpSettings.user,
            pwd: ftpSettings.pwd,
            savepwd: ftpSettings.savepwd,
            remoteroot: ftpSettings.remoteRoot,
            Strings: Strings
        };
                
        Dialogs.showModalDialogUsingTemplate(Mustache.render(mainDialog, templateVars), false);

        // focus to host input and add button handlers
        var $dlg = $(".ftp-dialog.instance");
        $dlg.find("#host").focus();
        $dlg.find(".dialog-button[data-button-id='ok']").on("click", handleOk);
        $dlg.find(".dialog-button[data-button-id='cancel']").on("click", handleCancel);
        

    }
    
    // call node for ftp upload
    function callFtpUpload() {
        
        var ftpPromise = nodeConnection.domains.ftpsync.ftpUpload(ftpSettings.host, ftpSettings.port, ftpSettings.user, ftpSettings.pwd, ftpSettings.localRoot, ftpSettings.remoteRoot);
        ftpPromise.fail(function (err) {
            console.error("[ftp-sync] failed to complete ftp upload:", err);
        });
        ftpPromise.done(function (memory) {
            console.log("[ftp-sync] started ftp upload");
        });
        return ftpPromise;
    }

    // call node for ftp stop
    function callFtpStop() {
        
        var ftpPromise = nodeConnection.domains.ftpsync.ftpStop();
        ftpPromise.fail(function (err) {
            console.error("[ftp-sync] failed to complete ftp stop:", err);
        });
        ftpPromise.done(function (memory) {
            console.log("[ftp-sync] ftp upload stopped");
        });
        return ftpPromise;
    }

    
    
    // Helper function that chains a series of promise-returning
    // functions together via their done callbacks.
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }

    

    
    AppInit.appReady(function () {

        // Create a new node connection.
        nodeConnection = new NodeConnection();
        
        // Every step of communicating with node is asynchronous, and is
        // handled through jQuery promises. To make things simple, we
        // construct a series of helper functions and then chain their
        // done handlers together. Each helper function registers a fail
        // handler with its promise to report any errors along the way.
        
        
        // Helper function to connect to node
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[ftp-sync] failed to connect to node");
            });
            return connectionPromise;
        }
        
        // Helper function that loads our domain into the node server
        function loadFtpDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/ftpDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[ftp-sync] failed to load domain");
            });
            loadPromise.done(function () {
                 console.log("[ftp-sync] loaded");
            });
            return loadPromise;
        }
        
            
        
        // Call all the helper functions in order
        chain(connect, loadFtpDomain);

        // load stylesheet
        ExtensionUtils.loadStyleSheet(module, "styles/styles.css");
        
        // add icon to toolbar & listener
        $("#main-toolbar .buttons").append(toolbar);
        $("#toolbar-ftpsync").on("click", function() {
            showFtpDialog();
        });
        
        // get any existing settings
        readSettings();

        // listen for events
        $(nodeConnection).on("ftpsync.connected", handleEvent);
        $(nodeConnection).on("ftpsync.disconnected", handleEvent);
        $(nodeConnection).on("ftpsync.uploaded", handleEvent);
        $(nodeConnection).on("ftpsync.mkdir", handleEvent);
        $(nodeConnection).on("ftpsync.error", handleEvent);


//        console.log('binding Ctrl-W');
//        CommandManager.register("ftpsyncdialog", COMMAND_ID, showFtpDialog);
//        KeyBindingManager.addBinding(COMMAND_ID, "Ctrl-W", "mac");
//        KeyBindingManager.addBinding(COMMAND_ID, "Ctrl-W", "win");
        

    });
        
});
