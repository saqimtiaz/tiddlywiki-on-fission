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

FissionUploader.prototype.initialize = function(callback) {
	console.log("uploader initialize");
	callback();
};

// Converts base64 data into a form accepted by the backend for saving
FissionUploader.prototype._prepareUploadData = function (uploadItem) {
	if(uploadItem.isBase64) {
		const byteArray = Uint8Array.from(
			atob(uploadItem.text)
				.split('')
				.map(char => char.charCodeAt(0))
		);
		return byteArray;    
	} else {
		return uploadItem.text;
	}
};

// Returns the canonical_uri for a file that has been uploaded
FissionUploader.prototype._getCanonicalURI = function(uploadItem) {
	var filePath = this.outputBasePath.slice(1);
	filePath.push(uploadItem.filename);
	return `https://${fissionUserName}.files.fission.name/p/${filePath.join("/")}`;
}

// Returns the path object representing the path to which the file will be saved
FissionUploader.prototype._getUploadPath = function(uploadItem) {
	var pathParams = this.outputBasePath.slice();
	pathParams.splice(pathParams.length,0,uploadItem.filename);
	return this.webnative.path.file.apply(null,pathParams);
};

/*
Arguments:
uploadItem: object representing tiddler to be uploaded
callback accepts two arguments:
	err: error object if there was an error
	uploadItemInfo: object corresponding to the tiddler being uploaded with the following properties set:
	- title
	- canonical_uri (if available)
	- uploadComplete (boolean)
*/
FissionUploader.prototype.uploadFile = function(uploadItem,callback) {  
	var self = this,
		path = this._getUploadPath(uploadItem);
	//this.items.push(uploadItem);
	self.fs.add(path,self._prepareUploadData(uploadItem)).then(function() {
		var uploadInfo = { title: uploadItem.title },
			canonical_uri = self._getCanonicalURI(uploadItem);
		console.log(`Saved to ${path.file.join("/")} with canonical_uri ${canonical_uri}`);
		 // Set the canonical_uri
		uploadInfo.canonical_uri = canonical_uri;
		// Set updateProgress to true if the progress bar should be updated
		// For some uploaders where the data is just being added to the payload with no uploading taking place we may not want to update the progress bar
		uploadInfo.updateProgress = true;
		// Set uploadComplete to true if the uploaded file has been persisted and is available at the canonical_uri
		// This flag triggers the creation of a canonical_uri tiddler corresponding to the uploaded file
		// Here we set uploadComplete to false since with Fission the file uploaded will not be persisted until we call publish()
		uploadInfo.uploadComplete = false;
		callback(null,uploadInfo);
	}).catch(function(err) {
		alert(`Error saving file ${path.file.join("/")} to fission: ${err}`);
		callback(err,uploadInfo);
	});
};

/*
Arguments:
callback accepts two arguments:
	status: true if there was no error, otherwise false
	uploadInfoArray (optional): array of uploadInfo objects corresponding to the tiddlers that have been uploaded
		this is needed and should set the canonical_uri for each uploadItem if:
		- (a) uploadInfo.uploadComplete was not set to true in uploadFile AND 
		- (b) uploadInfo.canonical_uri was not set in uploadFile
*/
FissionUploader.prototype.deinitialize = function(callback) {
	this.fs.publish().then(function() {
		console.log("uploader deinitialize");
		callback();
	}).catch(function(err) {
		alert(`Error uploading to fission: ${err}`);
		callback(err);
	});
};

})();
