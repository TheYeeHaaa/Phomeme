"use strict";

var lookup;
var inputData;
var outputData;
var dictionary;

function requestFile(method, file, error, func, data) {
	var request = new XMLHttpRequest();
	request.open(method, file, true);
	request.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			func(this.responseText);
		}
	};
	request.onerror = function() {
		document.getElementById("title").innerHTML = "Error";
		document.getElementById("waiting").innerHTML = error + " Try installing a cross-origin extension.";
		document.getElementById("spinner").style.display = "none";
	};
	request.send(data);
}

function addLink(name, data, type, extension) {
	var blob = new Blob([data], { type: type });
	var url = window.URL.createObjectURL(blob);
	var element = document.getElementById(name);
	element.href = url;
	element.download = name + "." + extension;
}

function readFile(file, func) {
	var reader = new FileReader();
	reader.onload = function() {
		func(this.result, file.name, file.type);
	};
	reader.readAsText(file, "UTF-8");
}

function addBlob(file, extension, isInput) {
	var url = window.URL.createObjectURL(file);
	var player = document.getElementById(isInput ? "inputPlayer" : "outputPlayer");
	player.style.display = "inline-block";
	player.src = url;
	var name = isInput ? "input" : "output";
	var link = document.getElementById(name);
	link.style.display = "block";
	link.href = url;
	link.download = name + "." + extension;
}

function checkJson(element) {
	var isInput = element.id === "inputAudio";
	var file = element.files[0];
	if (!file) return;
	var lower = file.name.toLowerCase();
	if (lower.endsWith("json") || lower.endsWith("txt")) {
		readFile(file, function(content) {
			var transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
			transcript.innerHTML = lower.endsWith("txt") ? content : JSON.parse(content).transcript;
		});
	} else if (file.type.startsWith("audio")) {
		addBlob(file, file.name.split(".").pop(), isInput);
	}
}

function updatePresets(element) {
	var presets = document.getElementsByClassName("preset");
	var div = document.getElementById(element.value);
	for (var i = 0; i < presets.length; i++) {
		var preset = presets[i];
		preset.style.display = div === preset ? "block" : "none";
		for (var j = 0; j < preset.childNodes.length; j++) {
			preset.childNodes[j].required = div === preset;
		}
	}
}

function getText(node) {
	if (node.childNodes.length) {
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) {
			result += getText(node.childNodes[i]) + " ";
		}
		return result;
	} else {
		return node.textContent;
	}
}

function updateDownloads() {
	var chooseMethod = document.getElementById("chooseMethod").value;
	var matchWords = document.getElementById("matchWords").checked;
	var matchDiphones = document.getElementById("matchDiphones").checked;
	var matchTriphones = document.getElementById("matchTriphones").checked;
	var matchPunctuation = document.getElementById("matchPunctuation").checked;
	var matchExact = document.getElementById("matchExact").checked;
	var overlapStart = parseFloat(document.getElementById("overlapStart").value);
	var overlapEnd = parseFloat(document.getElementById("overlapEnd").value);
	var final = (dictionary ? speak : sing)(inputData, outputData, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchExact, overlapStart, overlapEnd);
	addLink("session", final, "application/xml", "sesx");
}

function microphone(element) {
	var isInput = element.id === "inputMic";
	var transcript = document.getElementById(isInput ? "inputScript" : "outputScript");
	if (element.active) {
		if (element.recognition) {
			element.recognition.stop();
		}
		if (element.recorder) {
			element.recorder.stop();
		}
		transcript.setAttribute("contenteditable", true);
		element.src = "microphone.png";
		element.active = false;
	} else {
		var Speech = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.oSpeechRecognition || window.msSpeechRecognition;
		if (Speech) {
			transcript.setAttribute("contenteditable", false);
			if (!element.recognition) {
				element.recognition = new Speech();
				element.recognition.continuous = true;
				element.recognition.interimResults = true;
				var final = transcript.innerHTML;
				element.recognition.onresult = function(e) {
					var temp = "";
					for (var i = e.resultIndex; i < e.results.length; i++) {
						if (event.results[i].isFinal) {
							final += event.results[i][0].transcript;
						} else {
							temp += event.results[i][0].transcript;
						}
					}
					transcript.innerHTML = final + "<span>" + temp + "</span>";
				};
				element.recognition.onend = function() {
					transcript.innerHTML = final;
				};
			}
			element.recognition.start();
		}
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
				element.recorder = new MediaRecorder(stream);
				var chunks = [];
				element.recorder.ondataavailable = function(e) {
					chunks.push(e.data);
				};
				element.recorder.onstop = function() {
					stream.getTracks()[0].stop();
					var blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
					//document.getElementById(isInput ? "inputAudio" : "outputAudio").files = new FileList(new File([blob], "filename"));
					addBlob(blob, "ogg", isInput);
				};
				element.recorder.start();
			}).catch(console.error);
		}
		element.src = "micactive.png";
		element.active = true;
	}
	return false;
}

function complete() {
	requestFile("GET", "lookup.json", "Couldn't load lookup table!", function(response) {
		lookup = JSON.parse(response);
		updateDownloads();
		document.getElementById("spinner").style.display = "none";
		document.getElementById("waiting").style.display = "none";
		document.getElementById("options").style.display = "block";
	});
}

function addOutput(data, name, type) {
	var extension = name ? name.split(".").pop() : "json";
	addLink("output", data, type || "application/json", extension);
	outputData = { data: data, type: extension };
	complete();
}

function finalResponse() {
	document.getElementById("waiting").innerHTML = "Response received! Waiting for the final response...";
	var file = document.getElementById("outputAudio").files[0];
	if (file) {
		if (file.type.startsWith("audio")) {
			var output = new FormData();
			output.append("audio", file);
			output.append("transcript", getText(document.getElementById("outputScript")));
			requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addOutput, output);
		} else {
			readFile(file, addOutput);
		}
	} else {
		document.getElementById("waiting").innerHTML = "Loading phone dictionary...";
		document.getElementById("chooseMethod").value = "longest";
		requestFile("GET", "phonedictionary.txt", "Couldn't load phone dictionary!", function(response) {
			dictionary = {};
			var lines = response.split("\n");
			for (var i = 0; i < lines.length; i++) {
				var phones = lines[i].split(" ");
				dictionary[phones[0]] = phones.slice(1);
			}
			var data = getText(document.getElementById("outputScript"));
			addLink("output", data, "text/plain", "txt");
			outputData = { data: data, type: "txt" };
			complete();
		});
	}
}

function addInput(data, name, type) {
	var extension = name ? name.split(".").pop() : "json";
	addLink("input", data, type || "application/json", extension);
	inputData = { data: data, type: extension };
	finalResponse();
}

function crossOrigin(func) {
	var input = document.getElementById("inputAudio").files[0];
	var output = document.getElementById("outputAudio").files[0];
	if (input && input.type.startsWith("audio") || output && output.type.startsWith("audio")) {
		var request = new XMLHttpRequest();
		request.open("GET", "http://gentle-demo.lowerquality.com", true);
		request.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				func();
			}
		};
		request.onerror = function() {
			window.alert("Please install a cross-origin extension for this to work!");
		};
		request.send();
	} else {
		func();
	}
}

function phomeme() {
	crossOrigin(function() {
		var preset = document.getElementById("preset").value;
		if (preset === "custom") {
			var file = document.getElementById("inputAudio").files[0];
			if (file.type.startsWith("audio")) {
				var input = new FormData();
				input.append("audio", file);
				input.append("transcript", getText(document.getElementById("inputScript")));
				requestFile("POST", "http://gentle-demo.lowerquality.com/transcriptions?async=false", "Couldn't receive a response!", addInput, input);
			} else {
				readFile(file, addInput);
			}
		} else {
			document.getElementById("waiting").innerHTML = "Loading " + preset + "...";
			requestFile("GET", preset + "/complete.json", "Couldn't load " + preset + "!", addInput);
		}
		document.getElementById("form").style.display = "none";
		document.getElementById("result").style.display = "block";
	});
	return false;
}