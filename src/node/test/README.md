Test code for the node-side of FTP-Sync

Requires mocha

  npm install -g mocha
  
  
core.js is the node-specfic code contained within ftpDomain.js. As the Brackets code is just message passing,
most of the complexity lives here. test.js brings core.js in via an eval but in an ideal world, core.js would
be a node module that is imported.