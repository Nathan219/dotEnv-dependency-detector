'use strict';

var fs = require('fs');
var path = require('path');
if (process.argv.length < 4) {
  console.log("usage: app [env file path] [root directory of code]");
  process.exit();
} else {
  var chosenFilePath = process.argv[2];
  var directoryPath = process.argv[3];
  loadVariablesFromFile(chosenFilePath);
}

var filesBeingProcessed = 0;
var missingVariables = {};
var linesToWrite = {};

var finder = require('findit')(directoryPath);

var timeoutFunction = function() {
  filesBeingProcessed--;
  if (filesBeingProcessed < 1) {
    console.log('****** ABOUT TO SAVE THE FILE *********');
    saveVariablesToFile(chosenFilePath);
  }
}

finder.on('directory', function (dir, stat, stop) {
  var base = path.basename(dir);
  if (base === '.git' || base === 'node_modules' || base === 'configs') stop();
  else console.log(dir + '/');

});
finder.on('end', function (file, stat) {
  console.log(missingVariables);
});


finder.on('stop', function (file, stat) {
  console.log("**** STOP ******");
});

finder.on('file', function (file, stat) {
//  console.log(file);
  checkForProcessEnvCall(file);
//  console.log(missingVariables);
});

function loadVariablesFromFile(filename) {
  fs.readFile(filename, 'utf8', function(err, data) {
    if (err) throw err;
    var constants = data.split("\n");
    constants.forEach(function(string) {
      if (string != '') {
        var parts = string.split("=");
        var member = parts[0].trim();
        missingVariables[member] = true;
        linesToWrite[member] = string;
      }
    });
  });
}

function saveVariablesToFile(filename) {
  var finishedLines = [];
  for (var string in linesToWrite) {
    if (! missingVariables.hasOwnProperty(string)) {
      finishedLines.push(linesToWrite[string]);
    }
  }
  console.log(linesToWrite);
  var newFilename = filename + "_fixed";
  fs.writeFile(newFilename, finishedLines.join("\n"), function(err) {
    if(err) {
      console.log(err);
    } else {
      console.log("The file was saved as " + newFilename);
    }
  });
}

function checkForProcessEnvCall(filename) {
  fs.readFile(filename, 'utf8', function(err, data) {
    filesBeingProcessed++;
    if (err) throw err;
    console.log('OK: ' + filename);
    data = data.replace(/ |\+|=|:|;|,|\)|\(|\|\||&&|]/gm, '\n');
    var lines = data.split("\n");
    lines.forEach(function(string) {
      removeDependencyFromList(string);
    });
    setTimeout(timeoutFunction, 1000);
  });
}

function removeDependencyFromList(string) {
  if (string.match(/process\.env\.[\w]*/gm)) {
    // We know there is at least one match in this line, but there may be more...
    var parts= string.split(".");
    if (parts.length != 3) {
      throw new Error("This line isn't correct " + string);
    } else {
      var clean = parts[2].trim();
      if (missingVariables.hasOwnProperty(clean)) {
        console.log("\n * Deleting " + clean + " from the list");
        delete missingVariables[clean];
      }
    }
  }
}