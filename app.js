'use strict';

var fs = require('fs');
var path = require('path');
var filesBeingProcessed = 0;
var missingVariables = {};
var linesToWrite = {};
var isInputaDir = false;
if (process.argv.length < 4) {
  console.log("usage: app [env file path] [root directory of code]");
  process.exit();
} else {
  var chosenFilePath = process.argv[2];
  var directoryPath = process.argv[3];
  var stats = fs.lstatSync(chosenFilePath);
  if (stats.isDirectory()) {
    isInputaDir = true;
    var fileList = fs.readdirSync(chosenFilePath);
    fileList.forEach(function(file) {
      if (file.indexOf('.env') === 0 && file.indexOf('.backup') < 0) {
        loadVariablesFromFile(chosenFilePath + "/" + file, file);
      }
    });
  } else {
    loadVariablesFromFile(chosenFilePath);
  }
  var finder = require('findit')(directoryPath);
}



var timeoutFunction = function() {
  filesBeingProcessed--;
  if (filesBeingProcessed < 1) {
    console.log('****** ABOUT TO SAVE THE FILE *********');
    saveVariablesToFile(chosenFilePath);
  }
};

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

function loadVariablesFromFile(filepath, file) {
  var data = fs.readFileSync(filepath, 'utf8');// ,function(err, data) {
  missingVariables[file] = {};
  linesToWrite[file] = {};
  var constants = data.split("\n");
  constants.forEach(function(string) {
    if (string != '') {
      var parts = string.split("=");
      var member = parts[0].trim();
      missingVariables[file][member] = true;
      linesToWrite[file][member] = string;
    }
  });
}

function saveVariablesToFile(filepath) {
  var finishedLines = {};
  for (var envFile in linesToWrite) {
    if (linesToWrite.hasOwnProperty(envFile)) {
      finishedLines[envFile] = [];
      for (var string in linesToWrite[envFile]) {
        if (!missingVariables[envFile].hasOwnProperty(string)) {
          finishedLines[envFile].push(linesToWrite[envFile][string]);
        }
      }
      var filename = filepath + ((isInputaDir) ? "/" + envFile : '');
      var newFilename = filename + ".backup";
      // Rename the old file as a backup
      var err = fs.renameSync(filename, newFilename);
      if (err) {
        console.log(err);
        continue;
      } else {
        console.log("The file was saved as " + newFilename);
      }
      // Now replace the old file with the slimmed down one
      err = fs.writeFileSync(filename, finishedLines[envFile].join("\n"));
      if (err) {
        console.log(err);
      } else {
        console.log("The file was saved as " + filename);
      }
    }
  }
}

function checkForProcessEnvCall(filepath) {
  filesBeingProcessed++;
  fs.readFile(filepath, 'utf8', function(err, data) {
    if (err) throw err;
    console.log('OK: ' + filepath);
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
      for (var envFile in missingVariables) {
        if (missingVariables.hasOwnProperty(envFile)) {
          if (missingVariables[envFile].hasOwnProperty(clean)) {
            console.log("\n * Deleting " + clean + " from " + envFile + "'s list");
            delete missingVariables[envFile][clean];
          }
        }
      }
    }
  }
}