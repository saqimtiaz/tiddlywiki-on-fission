/*\
title: $:/plugins/tiddlywiki/file-uploads/dummy-uploader.js
type: application/javascript
module-type: uploader

Mocks uploading to Fission Webnative filing system
Useful for testing the upload mechanism without uploading anything

\*/
(function(){


/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "dummy";

var DummyUserName;

exports.create = function(params) {
	return new DummyUploader(params);
};

function DummyUploader(params) {
	this.params = params || {};
	this.items = [];
	console.log("DummyUploader",params);
};

DummyUploader.prototype.uploadStart = function(callback) {
	console.log("uploadStart");
	callback([]);
};

DummyUploader.prototype.getCanonicalURI = function(item) {
	return `https://myusername.files.fission.name/p/${item.filename}`;
}

/*
item: object representing tiddler to be uploaded
callback accepts two arguments:
	status: true if there was no error, otherwise false
	item: object corresponding to the tiddler being uploaded
*/
DummyUploader.prototype.uploadFile = function(item,callback) {  
	var self = this;
	//this.items.push(item);
	// Mock uploading the file by logging to console.
	console.log(`Saved ${item.title}`);
	var canonical_uri	= self.getCanonicalURI(item);
	// Set the canonical_uri if available 
	item.canonical_uri = canonical_uri;
	// Set updateProgress to true if the progress bar should be updated
	// For some uploaders where the data is just being added to the payload with no uploading taking place we may not want to update the progress bar
	item.updateProgress = true;
	// Set uploadComplete to true if the uploaded file has been persisted and is available at the canonical_uri
	// This flag triggers the creation of a canonical_uri tiddler corresponding to the uploaded file
	item.uploadComplete = false;
	callback(true,item);
};

/*
callback accepts two arguments:
	status: true if there was no error, otherwise false
	items (optional): array of item objects corresponding to the tiddlers that have been uploaded
		this is needed and should set the canonical_uri for each item if:
		- (a) item.uploadComplete was not set to true in uploadFile AND 
		- (b) item.canonical_uri was not set in uploadFile
 */
DummyUploader.prototype.uploadEnd = function(callback) {
	// Mock finishing up operations that will complete the upload and persist the files
	console.log("upload end");
	callback(true);
};

})();
