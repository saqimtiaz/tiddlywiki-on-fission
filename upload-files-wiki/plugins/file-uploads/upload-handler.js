/*\
title: $:/plugins/tiddlywiki/file-uploads/uploadhandler.js
type: application/javascript
module-type: global
The upload handler manages uploading binary tiddlers to external storage.
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

UploadHandler.prototype.titleFileUploadFilter = "$:/config/fileUploadFilter";
UploadHandler.prototype.titleUploader = "$:/config/fileUploader";

function UploadHandler(options) {
	var self = this;
	this.wiki = options.wiki;
	this.wiki.addEventListener("change",function(changes){
		var callback = function() {
			delete self.uploadTask;
			console.log("check for pending uploads");
			// Check if there are any new tiddlers that need to be uploaded
			$tw.utils.nextTick(upload);
		};
		var upload = function() {
			var uploadFilter = self.wiki.getTiddlerText(self.titleFileUploadFilter),
				tiddlersToUpload = self.wiki.filterTiddlers(uploadFilter);
			if(tiddlersToUpload.length > 0) {
				// If we are not already uploading then start a new upload task
				// If an upload task is already in progress then new tiddlers that need to be uploaded will be picked up in the next task 
				if(!self.uploadTask) {
					// The tiddlers currently matching the upload filter are the paylaod for the upload task
					self.uploadTask = new UploadTask(tiddlersToUpload,{
						wiki: options.wiki,
						uploaderConfig: self.wiki.getTiddlerText(self.titleUploader).trim()
					});
					self.uploadTask.run(callback);
				}
			} else {
				console.log("no pending uploads");
			}
		};
		upload();
	});
};

function UploadTask(tiddlers,options) {
	var self = this;
	this.wiki = options.wiki;
	this.taskTiddlers = tiddlers;
	this.tiddlerInfo = {};
	this.uploader = this.getUploader(options.uploaderConfig);
};

UploadTask.prototype.run = function(uploadHandlerCallback){
	var self = this;
	self.uploader.uploadStart(function(){
		self.processTiddlerQueue(uploadHandlerCallback);
	});
};

UploadTask.prototype.getUploader = function(uploaderName) {
	var uploader;
	$tw.modules.forEachModuleOfType("uploader",function(title,module) {
		if(module.name === uploaderName) {
			uploader = module;
		}
	});
	return uploader && uploader.create();	
};

// Returns true if changeCount in tiddlerInfo is the same as the current changeCount of the tiddler
UploadTask.prototype.changeCountUnchanged = function(title) {
	var tiddler = this.wiki.getTiddler(title);
	if(tiddler && this.tiddlerInfo[title]) {
		var changeCount = this.wiki.getChangeCount(title);
		if(changeCount === this.tiddlerInfo[title].changeCount) {
			return true;
		}
	}
	return false;
};

// Converts a binary tiddler into a canonical_uri tiddler if:
// - the tiddler still exists
// - the tiddler has not changed since we uploaded it
UploadTask.prototype.makeCanonicalURITiddler = function(title) {
	var tiddler = this.wiki.getTiddler(title),
		canonical_uri = this.tiddlerInfo[title].canonical_uri;
	if(tiddler && canonical_uri && this.changeCountUnchanged(title)) {
		this.wiki.addTiddler(new $tw.Tiddler(tiddler,{text:"",_canonical_uri:canonical_uri}));
	} else {
		console.log(`Could not convert ${title} to a canonical_uri tiddler`);
	}
};

UploadTask.prototype.processTiddlerQueue = function(uploadHandlerCallback) {
	var self = this;
	var nextTiddlerIndex = 0;
	
	var uploadEndCallback = function(status,items) {
		if(status) {
			// Some uploaders may not have canonical_uris earlier and may pass an array of item objects with canonical_uri set
			$tw.utils.each(items,function(item){
				// For every uploaded tiddler save the canonical_uri if one has been returned
				if(item.uploadComplete && item.canonical_uri && item.title && self.tiddlerInfo[item.title]) {
					self.tiddlerInfo[item.title].canonical_uri = item.canonical_uri;
				}
			});
			// Convert all uploaded tiddlers for which we have a canonical_uri to canonical_uri tiddlers
			for(var title in self.tiddlerInfo) {
				self.makeCanonicalURITiddler(title);
			}
			delete self.uploader;
			self.tiddlerInfo = {};
			console.log("uploadEnd callback");
			alert(`Uploaded`);
			uploadHandlerCallback(true);
		} else {
			console.error("Error in uploadEnd");
		}
	};
	
	var uploadedTiddlerCallback = function(status,item) {
		if(status) {
			console.log(`upload callback for ${item.title}`);
			// Save the canonical_uri if one has been set
			if(item.canonical_uri) {
				self.tiddlerInfo[item.title].canonical_uri = item.canonical_uri;
			}
			// If uploadComplete is true then convert the tiddler to a canonical_uri tiddler
			if(item.uploadComplete) {
				self.makeCanonicalURITiddler(item.title);
				delete self.tiddlerInfo[item.title];
				//below line is for debugging only
			  //self.wiki.setText(item.title,"upload-status",null,"uploaded");
			}			
			nextTiddlerIndex++;
			uploadNextTiddler();
		} else {
			console.error(`there was an error uploading ${item.title}, aborting uploads`);
		}
	};
	
	var uploadNextTiddler = function() {
		var title,
			tiddler;
		// Skip over any queued tiddlers that might have been deleted
		while(nextTiddlerIndex < self.taskTiddlers.length && !tiddler) {
			title = self.taskTiddlers[nextTiddlerIndex];
			tiddler = self.wiki.getTiddler(title);
			if(!tiddler) {
				nextTiddlerIndex++;
			}
		}
		if(tiddler) {
				self.tiddlerInfo[title] = {
					changeCount : self.wiki.getChangeCount(title)
				}				
				var uploadItem = self.getTiddlerUploadItem(tiddler);
				self.uploader.uploadFile(uploadItem,function(status,item){
					$tw.utils.nextTick(function(){uploadedTiddlerCallback(status,item)});
				});
		} else {
			self.uploader.uploadEnd(uploadEndCallback);
		}
	};
	uploadNextTiddler();
};

UploadTask.prototype.getTiddlerUploadItem = function(tiddler) {
	
	//	TODO:
		// Need to sanitize tiddler titles to make sure they are valid file names
		// file names must be unique or we could overwrite the file corresponding to another uploaded tiddler.
	return {
		title: tiddler.fields.title,
		filename: tiddler.fields.title,
		text: tiddler.fields.text || "",
		type: tiddler.fields.type || "",
		isBase64: ($tw.config.contentTypeInfo[tiddler.fields.type] || {}).encoding  === "base64"
	};
}

exports.UploadHandler = UploadHandler;

})();
