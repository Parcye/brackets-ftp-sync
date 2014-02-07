/*
 * Copyright (c) 2013-2014 Tim Burgess. All rights reserved.
 *  
 * @author Tim Burgess <info@tim-burgess.com>
 * @license Tim Burgess 2014
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true, white: true, evil: true */
/*globals HOST:true,PORT:true,USER:true,PWD:true,LOCALROOT:true,REMOTEROOT:true,ftp:true,emit:true,_domainManager:true,connect*/

//(function () {

  var assert = require("assert");

//  eval(fs.readFileSync('core.js').toString());
  var ftpsync = require("./core.js");
  
  // mock domainmanager for event capture
  _domainManager = require("./MockDomainManager.js");

  PORT = 21;
  
//  describe('ftp-sync', function() {
//    describe('simple connect', function() {
//      it('connect and disconnect from remote host', function() {
        
        HOST = "webedge";
        USER = "a9113008";
        PWD = "koen11";
        LOCALROOT = "/Users/tim/work/test";
        REMOTEROOT = "public_html";


        ftpsync.connect(HOST, PORT, USER, PWD, LOCALROOT, REMOTEROOT, _domainManager);
//      })
//    })
//  })
//}());