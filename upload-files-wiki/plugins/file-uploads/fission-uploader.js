/*\
title: $:/plugins/tiddlywiki/file-uploads/fission-uploader.js
type: application/javascript
module-type: uploader

Handles uploading to Fission Webnative filing system

\*/
(function(){


/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "fission";

var fissionUserName;

exports.create = function(params) {
	//webnativeDetails does not provide access to webnative.path.file() and authenticatedUsername()
	var webnativeDetails = window.webnativeDetails || window.parent && window.parent.webnativeDetails,
		webnative = window.webnative || window.parent && window.parent.webnative,
		fs = webnativeDetails.fs;
	if(webnative) {
		if(!fissionUserName) {
			webnative.authenticatedUsername().then(result => {fissionUserName = result});
		}
		return new FissionUploader(params,webnative,fs);
	} else {
		return null;
	}
};

function FissionUploader(params,webnative,fs) {
	this.webnative = webnative;
	this.params = params || {};
	this.fs = fs;
	// TODO Path should be taken from a config tiddler specific to the uploader
	this.outputBasePath = ["public","photos"],
	console.log("FissionUploader",params);
};

FissionUploader.prototype.uploadStart = function(callback) {
	console.log("uploadStart");
	callback([]);
};

// Converts base64 data into a form accepted by the backend for saving
FissionUploader.prototype.prepareUploadData = function (item) {
	if(item.isBase64) {
		const byteArray = Uint8Array.from(
			atob(item.text)
				.split('')
				.map(char => char.charCodeAt(0))
		);
		return byteArray;    
	} else {
		return item.text;
	}
};

// Returns the canonical_uri for a file that has been uploaded
FissionUploader.prototype.getCanonicalURI = function(item) {
	var filePath = this.outputBasePath.slice(1);
	filePath.push(item.filename);
	return `https://${fissionUserName}.files.fission.name/p/${filePath.join("/")}`;
}

// Returns the path object representing the path to which the file will be saved
FissionUploader.prototype.getUploadPath = function(item) {
	var pathParams = this.outputBasePath.slice();
	pathParams.splice(pathParams.length,0,item.filename);
	return this.webnative.path.file.apply(null,pathParams);
};

/*
Arguments:
item: object representing tiddler to be uploaded
callback accepts two arguments:
	status: true if there was no error, otherwise false
	item: object corresponding to the tiddler being uploaded
*/
FissionUploader.prototype.uploadFile = function(item,callback) {  
	var self = this,
		path = this.getUploadPath(item);
	//this.items.push(item);
	self.fs.add(path,self.prepareUploadData(item)).then(function() {
		var canonical_uri	= self.getCanonicalURI(item);
		console.log(`Saved to ${path.file.join("/")} with canonical_uri ${canonical_uri}`);
		 // Set the canonical_uri
		item.canonical_uri = canonical_uri;
		// Set updateProgress to true if the progress bar should be updated
		// For some uploaders where the data is just being added to the payload with no uploading taking place we may not want to update the progress bar
		item.updateProgress = true;
		// Set uploadComplete to true if the uploaded file has been persisted and is available at the canonical_uri
		// This flag triggers the creation of a canonical_uri tiddler corresponding to the uploaded file
		// Here we set uploadComplete to false since with Fission the file uploaded will not be persisted until we call publish()
		item.uploadComplete = false;
		callback(true,item);
	}).catch(function(err) {
		alert(`Error saving file ${path.file.join("/")} to fission: ${err}`);
		callback(false,item);
	});
};

/*
Arguments:
callback accepts two arguments:
	status: true if there was no error, otherwise false
	items (optional): array of item objects corresponding to the tiddlers that have been uploaded
		this is needed and should set the canonical_uri for each item if:
		- (a) item.uploadComplete was not set to true in uploadFile AND 
		- (b) item.canonical_uri was not set in uploadFile
*/
FissionUploader.prototype.uploadEnd = function(callback) {
	this.fs.publish().then(function() {
		console.log("uploadEnd");
		callback(true);
	}).catch(function(err) {
		alert(`Error uploading to fission: ${err}`);
		callback(false);
	});
};

})();
