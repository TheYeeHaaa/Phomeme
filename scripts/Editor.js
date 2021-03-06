"use strict";

var player;
var initial;
var sideNav;
var playhead;
var playlist;
var frame = 0;
var timeLabel;
var playButton;
var activeDrag;
var detail = 10;
var scale = 100;
var offset = 0;
var draggedFile;
var activeSession;
var fileList = [];
var sampleRate = 44100;
var requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(e) { return window.setTimeout(e, 1000 / 60); };
var cancelFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.oCancelAnimationFrame || window.msCancelAnimationFrame || function(id) { window.clearTimeout(id); };

function setupAudio() {
	player = new (window.AudioContext || window.webkitAudioContext)();
	sampleRate = player.sampleRate;
	return player.suspend();
}

function fileBuffer(file, func) {
	var reader = new FileReader();
	reader.onload = function() {
		player.decodeAudioData(this.result, function(buffer) {
			func(buffer);
		});
	};
	reader.readAsArrayBuffer(file);
}

/*function urlBuffer(url, func) {
	var audioRequest = new XMLHttpRequest();
	audioRequest.open("GET", url, true);
	audioRequest.responseType = "arraybuffer";
	audioRequest.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			player.decodeAudioData(this.response, function(buffer) {
				func(buffer);
			});
		}
	};
	audioRequest.send();
}

function urlJson(url, func) {
	var jsonRequest = new XMLHttpRequest();
	jsonRequest.open("GET", url, true);
	jsonRequest.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			func(JSON.parse(this.responseText));
		}
	};
	jsonRequest.send();
}*/

function setPlayhead(seconds) {
	playhead.style.left = seconds * scale + "px";
	timeLabel.innerHTML = niceTime(seconds, true);
}

function draw() {
	if (player && player.state === "running") {
		setPlayhead(player.currentTime);
	}
	frame = requestFrame(draw);
}

function setSession(session) {
	if (activeSession) {
		for (var i = 0; i < activeSession.trackList.length; i++) {
			activeSession.trackList[i].elem.style.display = "none";
		}
	}
	for (var j = 0; j < session.trackList.length; j++) {
		session.trackList[j].elem.style.display = "flex";
	}
	activeSession = session;
	initial.style.display = session.trackList.length ? "none" : "block";
}

function Session(name) {
	this.realName = name;
	this.name = name + ".phomeme";
	this.type = "application/json";
	this.trackList = [];
	setSession(this);
}

function Clip(clipFile, clipTrack) {
	this.drag = 0;
	this.scale = 1;
	this.audioData;
	this.audioBuffer;
	this.duration = 0;
	this.track = clipTrack;
	this.active = false;
	this.startPoint = 0;
	this.edgeDrag = "";
	this.elem = document.createElement("canvas");
	this.elem.className = "clip";
	this.elem.width = "128";
	this.elem.height = "128";
	this.parent = document.createElement("div");
	this.parent.className = "clipdiv";
	this.parent.appendChild(this.elem);
	this.track.elem.appendChild(this.parent);
	this.elemLeft = document.createElement("div");
	this.elemLeft.className = "clipdragleft";
	this.parent.appendChild(this.elemLeft);
	this.elemRight = document.createElement("div");
	this.elemRight.className = "clipdragright";
	this.parent.appendChild(this.elemRight);
	this.context = this.elem.getContext("2d", { alpha: true });
	this.updateCanvas = function() {
		this.duration = this.audioBuffer.duration;
		this.elem.width = this.duration * scale;
		this.context.clearRect(0, 0, this.elem.width, this.elem.height);
		var lines = this.elem.width * detail;
		this.context.lineWidth = 0.5;
		this.context.strokeStyle = "white";
		this.context.beginPath();
		for (var k = 0; k < lines; k++) {
			var x = k / lines * this.elem.width;
			var y = this.elem.height * 0.5;
			var index = this.audioData[Math.floor((k / detail + offset) * (sampleRate / scale))];
			this.context.lineTo(x, y + (index || 0) * y);
		}
		this.context.stroke();
	};
	this.clicked = function(e) {
		e.preventDefault();
		activeDrag = this;
		this.drag = e.pageX - (this.startPoint * scale);
	};
	this.elem.addEventListener("mousedown", this.clicked.bind(this));
	this.setScale = function(stretch) {
		this.scale = stretch;
		this.elem.style.width = this.elem.width + this.scale + "px";
	}
	this.dragLeft = function(e) {
		e.preventDefault();
		activeDrag = this;
		this.edgeDrag = "left";
	};
	this.elemLeft.addEventListener("mousedown", this.dragLeft.bind(this));
	this.dragRight = function(e) {
		e.preventDefault();
		activeDrag = this;
		this.edgeDrag = "right";
		this.drag = e.pageX - (this.startPoint * scale);
	};
	this.elemRight.addEventListener("mousedown", this.dragRight.bind(this));
	this.drawLoading = function() {
		this.context.fillStyle = "white";
		this.context.textAlign = "center";
		this.context.textBaseline = "middle";
		this.context.font = "16px Arial";
		this.context.fillText("LOADING...", this.elem.width * 0.5, this.elem.height * 0.5);
	};
	this.loadFile = function(file) {
		if (!player) {
			setupAudio();
		}
		this.drawLoading();
		fileBuffer(file, function(buffer) {
			this.audioData = buffer.getChannelData(0);
			this.audioBuffer = buffer;
			this.updateCanvas();
		}.bind(this));
	};
	this.loadFile(clipFile);
	this.changeTrack = function(track) {
		this.track.removeClip(this);
		track.addClip(this);
		this.track = track;
		track.elem.appendChild(this.parent);
	};
	this.setStart = function(start) {
		this.startPoint = start / scale;
		this.parent.style.left = start + "px";
	};
}

function Track() {
	this.clips = [];
	this.elem = document.createElement("div");
	this.elem.className = "track";
	playlist.appendChild(this.elem);
	this.addClip = function(clip) {
		this.clips.push(clip);
	};
	this.loadClip = function(file) {
		var clip = new Clip(file, this);
		this.addClip(clip);
		return clip;
	};
	this.removeClip = function(clip) {
		var index = this.clips.indexOf(clip);
		if (index !== -1) {
			this.clips.splice(index, 1);
		}
	};
	this.moved = function(e) {
		if (activeDrag && activeDrag.track && !activeDrag.edgeDrag && activeDrag.track !== this) {
			e.preventDefault();
			activeDrag.changeTrack(this);
		}
	};
	this.elem.addEventListener("mousemove", this.moved.bind(this));
	this.dragover = function(e) {
		if (draggedFile) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}
	};
	this.elem.addEventListener("dragover", this.dragover.bind(this));
	this.drop = function(e) {
		if (draggedFile) {
			e.preventDefault();
			var clip = this.loadClip(draggedFile);
			clip.setStart(e.clientX - this.elem.getBoundingClientRect().left);
			draggedFile = undefined;
		}
	};
	this.elem.addEventListener("drop", this.drop.bind(this));
	this.trackIndex = activeSession.trackList.push(this);
	initial.style.display = "none";
}

function ListedFile(file) {
	this.file = file;
	this.elem = document.createElement("a");
	this.elem.draggable = true;
	this.elem.innerHTML = this.file.name;
	sideNav.appendChild(this.elem);
	this.elem.addEventListener("dragstart", function() {
		if (this.file.type.startsWith("audio")) {
			draggedFile = this.file;
		}
	}.bind(this));
	this.elem.addEventListener("click", function() {
		if (this.file.trackList) {
			setSession(this.file);
		}
	}.bind(this));
	fileList.push(this);
}

function closeMenus() {
	var dropdowns = document.getElementsByClassName("dropcontent");
	for (var i = 0; i < dropdowns.length; i++) {
		dropdowns[i].style.display = "none";
	}
}

function moved(e) {
	if (activeDrag) {
		if (activeDrag.track) {
			if (activeDrag.edgeDrag === "left") {
				// drag left
			} else if (activeDrag.edgeDrag === "right") {
				e.preventDefault();
				activeDrag.setScale(e.pageX - activeDrag.drag);
				// drag right
			} else {
				e.preventDefault();
				activeDrag.setStart(e.pageX - activeDrag.drag);
			}
		} else if (activeDrag === "playhead") {
			e.preventDefault();
			setPlayhead((e.clientX - timeline.getBoundingClientRect().left) / scale);
		}
	}
}

function ended() {
	if (activeDrag.edgeDrag) {
		activeDrag.edgeDrag = undefined;
	}
	activeDrag = undefined;
}

function padTime(num, size) {
	return ("000" + num).slice(-size);
}

function niceTime(timeInSeconds, detailed) {
	var time = parseFloat(timeInSeconds).toFixed(3);
	var hours = Math.floor(time / 60 / 60);
	var minutes = Math.floor(time / 60) % 60;
	var seconds = Math.floor(time - minutes * 60);
	if (detailed) {
		var milliseconds = time.slice(-3);
		return padTime(hours, 1) + ":" + padTime(minutes, 2) + ":" + padTime(seconds, 2) + "." + padTime(milliseconds, 3);
	} else {
		return padTime(minutes, 1) + ":" + padTime(seconds, 2);
	}
}

function setup() {
	playlist = document.getElementById("playlist");
	playhead = document.getElementById("playhead");
	playButton = document.getElementById("play");
	initial = document.getElementById("initial");
	sideNav = document.getElementById("sidenav");
	timeLabel = document.getElementById("time");
	window.addEventListener("mousemove", moved);
	window.addEventListener("mouseup", ended);
	new ListedFile(new Session("Untitled Session"));
	var timeline = document.getElementById("timeline");
	for (var i = 0; i < scale * 10; i += scale) {
		var timeNotch = document.createElement("span");
		timeNotch.innerHTML = niceTime(i / scale, false);
		timeNotch.className = "timenotch";
		timeNotch.style.left = i + "px";
		timeline.appendChild(timeNotch);
	}
	timeline.addEventListener("mousedown", function() {
		activeDrag = "playhead";
	});
	timeline.addEventListener("click", function(e) {
		setPlayhead((e.clientX - this.getBoundingClientRect().left) / scale);
	});
	/*urlBuffer("donkeykong/input.wav", function(buffer) {
		sample = { buffer: buffer, data: buffer.getChannelData(0) };
	});
	urlJson("donkeykong/complete.json", function(response) {
		json = response;
	});*/
	window.addEventListener("click", function(e) {
		if (!e.target.matches(".dropbutton")) {
			closeMenus();
		}
	});
	requestFrame(draw);
}

function toggle(element) {
	var dropdown = element.nextSibling.nextSibling;
	var previous = dropdown.style.display;
	closeMenus();
	dropdown.style.display = previous === "block" ? "none" : "block";
}

function newSession() {
	var sessionName = window.prompt("Please enter a session name", "Untitled Session");
	if (sessionName) {
		new ListedFile(new Session(sessionName));
	}
}

function loadSession(element) {
	console.log(element.files[0]);
	element.value = null;
}

function importFile(element) {
	for (var i = 0; i < element.files.length; i++) {
		var file = element.files[i];
		new ListedFile(file);
		if (file.type.startsWith("audio")) {
			var track = new Track();
			track.loadClip(file);
		}
	}
	element.value = null;
}

function playSession() {
	if (!player) return;
	if (player.state === "running") {
		playButton.value = "►";
		player.close();
		setupAudio();
	} else {
		playButton.value = "❚❚";
		for (var i = 0; i < activeSession.trackList.length; i++) {
			for (var j = 0; j < activeSession.trackList[i].clips.length; j++) {
				var clip = activeSession.trackList[i].clips[j];
				var bufferNode = player.createBufferSource();
				bufferNode.buffer = clip.audioBuffer;
				bufferNode.connect(player.destination);
				bufferNode.start(Math.max(0, clip.startPoint), Math.max(0, -clip.startPoint), clip.duration); // when, offset, duration
			}
		}
		player.resume();
	}
}

/*function drawLine(context, x, y, x2, y2) {
	context.beginPath();
	context.moveTo(x, y);
	context.lineTo(x2, y2);
	context.stroke();
}

function drawBoxes(json, audio) {
	if (json) {
		context.font = "16px Courier New";
		context.textAlign = "center";
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			if (word.case === "not-found-in-audio") continue;
			if (word.active) {
				context.fillStyle = "#004000";
				var start = word.start * scale - offset;
				context.fillRect(start, yPos + 20, -scale * (word.active - player.currentTime), height - 40);
			}
			context.lineWidth = 1;
			context.fillStyle = "white";
			context.strokeStyle = "#004000";
			if (word.phones) {
				context.textBaseline = "bottom";
				var duration = word.start * scale;
				for (var j = 0; j < word.phones.length; j++) {
					var phone = word.phones[j].phone.split("_")[0].toUpperCase();
					var length = word.phones[j].duration * scale;
					drawLine(context, duration - offset, yPos + 20, duration - offset, yPos + height);
					drawLine(context, duration + length - offset, yPos + 20, duration + length - offset, yPos + height);
					context.fillText(phone, duration + length * 0.5 - offset, yPos + height);
					duration += length;
				}
			}
			context.lineWidth = 2;
			context.strokeStyle = "#00FF00";
			drawLine(context, word.start * scale - offset, yPos, word.start * scale - offset, yPos + height);
			drawLine(context, word.end * scale - offset, yPos, word.end * scale - offset, yPos + height);
			context.textBaseline = "top";
			var difference = (word.end - word.start) * 0.5;
			context.fillText(word.word, scale * (word.start + difference) - offset, yPos);
		}
	}
	if (audio) {
		COPIED UP THERE ALREADY
	}
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	drawLine(context, 0, yPos + 20, canvas.width, yPos + 20);
	drawLine(context, 0, yPos + height - 20, canvas.width, yPos + height - 20);
}

function drawScroll(audio) {
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	context.strokeRect(0, 0, canvas.width, scrollHeight);
	if (!audio) return;
	context.lineWidth = 1;
	context.strokeStyle = "white";
	context.beginPath();
	var lines = canvas.width * 8;
	for (var k = 0; k < lines; k++) {
		var x = k / lines * canvas.width;
		var y = scrollHeight * 0.5;
		var index = audio[Math.floor(k / lines * audio.length)];
		context.lineTo(x, y + scrollHeight * (index || 0));
	}
	context.stroke();
	context.lineWidth = 2;
	context.strokeStyle = "#00FF00";
	var position = (offset * sampleRate * canvas.width) / (scale * audio.length);
	var size = (sampleRate * canvas.width * canvas.width) / (scale * audio.length);
	context.strokeRect(position, 0, size, scrollHeight);
}

function clamp(offset) {
	if (sample) {
		return Math.min(Math.max(offset, 0), sample.buffer.length * scale / sampleRate - canvas.width);
	} else {
		return Math.max(offset, 0);
	}
}

function wheel(e) {
	e.preventDefault();
	offset = clamp(offset + e.deltaX);
}

function clicked(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (e.pageY > yPos && e.pageY < yPos + height) {
		var match;
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			var start = word.start * scale - offset;
			var end = word.end * scale - offset;
			if (near(e.pageX, start)) {
				dragging = { key: word, value: "start" };
				canvas.style.cursor = "col-resize";
			} else if (near(e.pageX, end)) {
				dragging = { key: word, value: "end" };
				canvas.style.cursor = "col-resize";
			} else if (e.pageX > start && e.pageX < end) {
				match = word;
			}
		}
		if (match !== undefined) {
			var source = player.createBufferSource();
			source.buffer = sample && sample.buffer;
			source.connect(player.destination);
			var duration = match.end - match.start;
			source.start(0, match.start, duration);
			match.active = player.currentTime;
			window.setTimeout(function() {
				match.active = false;
			}, duration * 1000);
		}
	} else if (e.pageY < scrollHeight) {
		if (!sample) return;
		var start = (offset * sampleRate * canvas.width) / (sample.buffer.length * scale);
		var end = (canvas.width * sampleRate * canvas.width) / (sample.buffer.length * scale);
		if (near(e.pageX, start)) {
			dragging = { initial: offset, direction: true };
		} else if (near(e.pageX, start + end)) {
			dragging = { initial: offset, direction: false };
		} else {
			offset = clamp((e.pageX * sample.buffer.length * scale) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
			dragging = true;
		}
	}
}

function near(x, y) {
	return x > y - 4 && x < y + 4;
}

function moved(e) {
	e.preventDefault();
	if (!json || !json.words) return;
	if (!dragging && e.pageY > yPos && e.pageY < yPos + height) {
		var hovering = false;
		for (var i = 0; i < json.words.length; i++) {
			var word = json.words[i];
			var start = word.start * scale - offset;
			var end = word.end * scale - offset;
			if (near(e.pageX, start) || near(e.pageX, end)) {
				hovering = true;
			}
		}
		canvas.style.cursor = hovering ? "col-resize" : "auto";
	} else if (!dragging && e.pageY < scrollHeight) {
		if (!sample) return;
		var start = (offset * sampleRate * canvas.width) / (sample.buffer.length * scale);
		var end = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * scale);
		if (near(e.pageX, start) || near(e.pageX, start + end)) {
			canvas.style.cursor = "col-resize";
		} else {
			canvas.style.cursor = "grab";
		}
	} else {
		canvas.style.cursor = "auto";
	}
	if (dragging) {
		if (dragging.key) {
			dragging.key[dragging.value] = (e.pageX + offset) / scale;
			canvas.style.cursor = "col-resize";
		} else if (dragging.direction !== undefined) {
			if (dragging.direction) {
				//offset = (offset / dragging.initial) * sampleRate;
				//scale = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * e.pageX); // todo
				//offset = clamp((e.pageX * sample.buffer.length * scale) / (sampleRate * canvas.width));
			} else {
				//scale = (sampleRate * canvas.width * canvas.width) / (sample.buffer.length * e.pageX);
				//offset = (dragging.initial / offset); // todo
			}
		} else {
			offset = clamp((e.pageX * sample.buffer.length * scale) / (sampleRate * canvas.width) - (0.5 * canvas.width));
			canvas.style.cursor = "grabbing";
		}
	}
}

function ended(e) {
	e.preventDefault();
	canvas.style.cursor = "auto";
	dragging = false;
}

function draw() {
	context.fillStyle = "#061306";
	context.fillRect(0, 0, canvas.width, canvas.height);
	drawBoxes(json, sample && sample.buffer);
	drawScroll(sample && sample.buffer);
	frame = requestFrame(draw);
}*/