const express = require('express');
const { exec, execSync } = require('child_process');
const bodyParser = require('body-parser');
const csv = require('csv-parse/sync');
const fs = require('fs');
const touch = require('touch');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3000;

function fahrenheitToCelsius(fahrenheit) {
	return ((fahrenheit - 32) * 5 / 9).toFixed(2);
}

function getColorForTemperature(value) {
	const maxTemp = 100;
	const minTemp = 50;
	const ratio = (value - minTemp) / (maxTemp - minTemp);
	const hue = 240 - ratio * 240; // from blue (240) to red (0)
	return `hsl(${hue}, 100%, 50%)`;
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Serve static files like index.html and bg.png
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

app.get('/bg.png', (req, res) => {
	res.sendFile(__dirname + '/bg.png');
});

app.get('/ip.html', (req, res) => {
	res.sendFile(__dirname + '/ip.html');
});

app.get('/setrelayips.html', (req, res) => {
	res.sendFile(__dirname + '/setrelayips.html');
});

app.get('/wifi.html', (req, res) => {
	res.sendFile(__dirname + '/wifi.html');
});

app.get('/adv.html', (req, res) => {
	res.sendFile(__dirname + '/adv.html');
});

app.get('/afterburner.html', (req, res) => {
	res.sendFile(__dirname + '/afterburner.html');
});

app.get('/temp.csv', (req, res) => {
	res.sendFile(__dirname + '/temp.csv');
});

app.get('/offset.csv', (req, res) => {
	res.sendFile(__dirname + '/offset.csv');
});

app.get('/offset2.csv', (req, res) => {
	res.sendFile(__dirname + '/offset2.csv');
});

app.get('/offset3.csv', (req, res) => {
	res.sendFile(__dirname + '/offset3.csv');
});

app.get('/clearip.js', (req, res) => {
	res.sendFile(__dirname + '/clearip.js');
});

app.get('/offsets.html', (req, res) => {
	res.sendFile(__dirname + '/offsets.html');
});

app.post('/afterburner', (req, res) => {
	touch('/home/100acresheater/AFTERBURNER', function(err) {
		if (err) {
			// Handle any errors here
			console.error('Error touching the file:', err);
		}
	});
});

app.post('/afterburneroff', (req, res) => {
	const filePath = '/home/100acresheater/AFTERBURNER';

	// Check if the file exists
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			return res.status(404).send('File not found');
		}

		// File exists, delete it
		fs.unlink(filePath, (err) => {
			if (err) {
				// Error in deleting the file
				console.error('Error deleting the file:', err);
				return res.status(500).send('Error deleting file');
			}

			// File successfully deleted
			res.send('Afterburner turned off');
		});
	});
});

app.get('/checkAfterburner', (req, res) => {
	const filePath = '/home/100acresheater/AFTERBURNER';

	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			return res.json({ exists: false });
		}
		res.json({ exists: true });
	});
});

app.get('/autofan', (req, res) => {
	// Function to execute commands with the given IP
	const executeCommands = (ip, callback) => {
		// Kill command
		exec(`echo '{"command": "kill"}' | nc ${ip} 4028`, (error, stdout, stderr) => {
			if (error) {
				console.error(`error: ${error.message}`);
				return callback('Error executing kill command');
			}
			if (stderr) {
				console.error(`stderr: ${stderr}`);
				return callback('Error executing kill command');
			}

			// Logon command
			exec(`echo '{"command": "logon"}' | nc ${ip} 4028 | jq -r '.SESSION[0].SessionID'`, (logonError, logonStdout, logonStderr) => {
				if (logonError) {
					console.error(`logonError: ${logonError.message}`);
					return callback('Error executing logon command');
				}
				if (logonStderr) {
					console.error(`logonStderr: ${logonStderr}`);
					return callback('Error executing logon command');
				}

				const session = logonStdout.trim();

				// Fan set command
				exec(`echo '{"command": "fanset", "parameter":"${session},-1,1"}' | nc ${ip} 4028 | jq`, (fanSetError, fanSetStdout, fanSetStderr) => {
					if (fanSetError) {
						console.error(`fanSetError: ${fanSetError.message}`);
						return callback('Error executing fanset command');
					}
					if (fanSetStderr) {
						console.error(`fanSetStderr: ${fanSetStderr}`);
						return callback('Error executing fanset command');
					}

					callback(null, fanSetStdout);
				});
			});
		});
	};

	// Function to read IP from file and execute commands
	const readIPAndExecute = (filePath, callback) => {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
				console.error('Error reading IP from file:', err);
				return callback('Error reading IP address');
			}

			const ip = data.trim();
			executeCommands(ip, callback);
		});
	};
readIPAndExecute('/home/100acresheater/ip1.csv', (err1, result1) => {
    if (err1) {
        res.status(500).send(err1);
    } else {
        readIPAndExecute('/home/100acresheater/ip2.csv', (err2, result2) => {
            if (err2) {
                res.status(500).send(err2);
            } else {
                readIPAndExecute('/home/100acresheater/ip3.csv', (err3, result3) => {
                    if (err3) {
                        res.status(500).send(err3);
                    } else {
                        readIPAndExecute('/home/100acresheater/ip4.csv', (err4, result4) => {
                            if (err4) {
                                res.status(500).send(err4);
                            } else {
                                readIPAndExecute('/home/100acresheater/ip5.csv', (err5, result5) => {
                                    if (err5) {
                                        res.status(500).send(err5);
                                    } else {
                                        res.send({ result1, result2, result3, result4, result5 });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }
});

});


app.post('/tempset', (req, res) => {
	const temperature = Number(req.body.temperature);
	if (isNaN(temperature) || temperature < 50 || temperature > 100) {
		res.status(400).send('Invalid temperature value. It must be a number between 50 and 100 before applying offset.');
		return;
	}

	// Append adjusted temperature to temp.csv
	fs.writeFile('temp.csv', `${temperature}\n`, (err) => {
		if (err) {
			console.error('Error writing to file', err);
			res.status(500).send('Error writing to file');
		} else {
			res.status(200).send(`Temperature set successfully to ${temperature}`);
		}
	});
});

// Endpoint to submit IP address
app.post('/submit-ip', (req, res) => {
	const ip = req.body.ip;
	// Save IP address to ip.csv
	fs.writeFileSync('ip1.csv', ip);
	res.send('IP address saved successfully');
});

app.post('/submit-ip2', (req, res) => {
	const ip = req.body.ip;
	// Save IP address to ip.csv
	fs.writeFileSync('ip2.csv', ip);
	res.send('IP address 2 saved successfully');
});

app.post('/submit-ip3', (req, res) => {
	const ip = req.body.ip;
	// Save IP address to ip.csv
	fs.writeFileSync('ip3.csv', ip);
	res.send('IP address 3 saved successfully');
});

app.post('/submit-ip4', (req, res) => {
	const ip = req.body.ip;
	// Save IP address to ip.csv
	fs.writeFileSync('ip4.csv', ip);
	res.send('IP address 4 saved successfully');
});

app.post('/submit-ip5', (req, res) => {
	const ip = req.body.ip;
	// Save IP address to ip.csv
	fs.writeFileSync('ip5.csv', ip);
	res.send('IP address 5 saved successfully');
});

// Endpoint to configure WiFi
app.post('/wificonfig', (req, res) => {
	const wifiName = req.body.wifi_name;
	const wifiPassword = req.body.wifi_password;
	//Basic validation to prevent command injection
	if (!wifiName.match(/^[a-zA-Z0-9_\-]+$/) || !wifiPassword.match(/^[a-zA-Z0-9_\-]+$/)) {
		return res.status(400).send('Invalid characters in WiFi name or password.');
	}

	const command = `sudo nmcli device wifi connect "${wifiName}" password "${wifiPassword}"`;

	exec(command, (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return res.status(500).send('Error configuring WiFi.');
		}
		res.send('WiFi configured successfully.');
	});
});

app.get('/asicstats.html', async (req, res) => {
	try {
		// Check if ip.csv exists
		if (!fs.existsSync('ip1.csv')) {
			return res.send(''); // Send blank response
		}
		const ip = fs.readFileSync('ip1.csv', 'utf8').trim();
		const scanCommand = `/home/100acresheater/luxminer-cli-linux-arm64 scan range ${ip} ${ip} -o minerz.csv`;

		exec(scanCommand, async (error, stdout, stderr) => {
			if (error) {
				throw error; // Throw the error to be caught by the outer try-catch
			}

			const minerData = fs.readFileSync('minerz.csv', 'utf8');
			const [miner] = csv.parse(minerData, { columns: true, skip_empty_lines: true });

			const tempCommand = `echo '{"command": "temps"}' | nc ${ip} 4028`;
			const tempData = execSync(tempCommand).toString();
			const tempJson = JSON.parse(tempData);

			const summaryCommand = `echo '{"command": "summary"}' | nc ${ip} 4028`;
			const summaryData = execSync(summaryCommand).toString();
			const summaryJson = JSON.parse(summaryData);

			let html = '<head><style>div { background: rgba(255, 255, 255, .1);font-size: 1rem;color: orange;border: 1px solid orange; border-radius: 50%; width: fit-content;display: grid;justify-content: center;align-items: center;margin: 0;aspect-ratio: 1 / 1;text-align: center;padding: 0;margin: 0;width: 7rem;height: 7rem; } body { display: flex;color: orange;font-weight: bold;margin: 0;padding: 0; }</style></head><body>';
			html += `<div>Hashrate:<br>${(summaryJson.SUMMARY[0]["GHS av"] / 1000).toFixed(2)}TH/s</div>`;
			html += `<div>Chips Frequency:<br>${miner.frequency}Mhz</div>`;
			html += `<div>Chips Temps:<br>`;
			tempJson.TEMPS.forEach(temp => {
				const avgTemp = (temp.BottomLeft + temp.BottomRight + temp.TopLeft + temp.TopRight) / 4;
				html += `ID ${temp.ID}: ${avgTemp.toFixed(2)}°C<br>`;
			});
			html += '</div></body>';

			res.send(html);
		});
	} catch (err) {
		console.error(`An error occurred: ${err.message}`);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/asicstats2.html', async (req, res) => {
	try {
		// Check if ip.csv exists
		if (!fs.existsSync('ip2.csv')) {
			return res.send(''); // Send blank response
		}
		const ip = fs.readFileSync('ip2.csv', 'utf8').trim();
		const scanCommand = `/home/100acresheater/luxminer-cli-linux-arm64 scan range ${ip} ${ip} -o minerz.csv`;

		exec(scanCommand, async (error, stdout, stderr) => {
			if (error) {
				throw error; // Throw the error to be caught by the outer try-catch
			}

			const minerData = fs.readFileSync('minerz.csv', 'utf8');
			const [miner] = csv.parse(minerData, { columns: true, skip_empty_lines: true });

			const tempCommand = `echo '{"command": "temps"}' | nc ${ip} 4028`;
			const tempData = execSync(tempCommand).toString();
			const tempJson = JSON.parse(tempData);

			const summaryCommand = `echo '{"command": "summary"}' | nc ${ip} 4028`;
			const summaryData = execSync(summaryCommand).toString();
			const summaryJson = JSON.parse(summaryData);

			let html = '<head><style>div { background: rgba(255, 255, 255, .1);font-size: 1rem;color: orange;border: 1px solid orange; border-radius: 50%; width: fit-content;display: grid;justify-content: center;align-items: center;margin: 0;aspect-ratio: 1 / 1;text-align: center;padding: 0;margin: 0;width: 7rem;height: 7rem; } body { display: flex;color: orange;font-weight: bold;margin: 0;padding: 0; }</style></head><body>';
			html += `<div>Hashrate:<br>${(summaryJson.SUMMARY[0]["GHS av"] / 1000).toFixed(2)}TH/s</div>`;
			html += `<div>Chips Frequency:<br>${miner.frequency}Mhz</div>`;
			html += `<div>Chips Temps:<br>`;
			tempJson.TEMPS.forEach(temp => {
				const avgTemp = (temp.BottomLeft + temp.BottomRight + temp.TopLeft + temp.TopRight) / 4;
				html += `ID ${temp.ID}: ${avgTemp.toFixed(2)}°C<br>`;
			});
			html += '</div></body>';

			res.send(html);
		});
	} catch (err) {
		console.error(`An error occurred: ${err.message}`);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/asicstats3.html', async (req, res) => {
	try {
		// Check if ip.csv exists
		if (!fs.existsSync('ip3.csv')) {
			return res.send(''); // Send blank response
		}
		const ip = fs.readFileSync('ip3.csv', 'utf8').trim();
		const scanCommand = `/home/100acresheater/luxminer-cli-linux-arm64 scan range ${ip} ${ip} -o minerz.csv`;

		exec(scanCommand, async (error, stdout, stderr) => {
			if (error) {
				throw error; // Throw the error to be caught by the outer try-catch
			}

			const minerData = fs.readFileSync('minerz.csv', 'utf8');
			const [miner] = csv.parse(minerData, { columns: true, skip_empty_lines: true });

			const tempCommand = `echo '{"command": "temps"}' | nc ${ip} 4028`;
			const tempData = execSync(tempCommand).toString();
			const tempJson = JSON.parse(tempData);

			const summaryCommand = `echo '{"command": "summary"}' | nc ${ip} 4028`;
			const summaryData = execSync(summaryCommand).toString();
			const summaryJson = JSON.parse(summaryData);

			let html = '<head><style>div { background: rgba(255, 255, 255, .1);font-size: 1rem;color: orange;border: 1px solid orange; border-radius: 50%; width: fit-content;display: grid;justify-content: center;align-items: center;margin: 0;aspect-ratio: 1 / 1;text-align: center;padding: 0;margin: 0;width: 7rem;height: 7rem; } body { display: flex;color: orange;font-weight: bold;margin: 0;padding: 0; }</style></head><body>';
			html += `<div>Hashrate:<br>${(summaryJson.SUMMARY[0]["GHS av"] / 1000).toFixed(2)}TH/s</div>`;
			html += `<div>Chips Frequency:<br>${miner.frequency}Mhz</div>`;
			html += `<div>Chips Temps:<br>`;
			tempJson.TEMPS.forEach(temp => {
				const avgTemp = (temp.BottomLeft + temp.BottomRight + temp.TopLeft + temp.TopRight) / 4;
				html += `ID ${temp.ID}: ${avgTemp.toFixed(2)}°C<br>`;
			});
			html += '</div></body>';

			res.send(html);
		});
	} catch (err) {
		console.error(`An error occurred: ${err.message}`);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/asicstats4.html', async (req, res) => {
	try {
		// Check if ip.csv exists
		if (!fs.existsSync('ip4.csv')) {
			return res.send(''); // Send blank response
		}
		const ip = fs.readFileSync('ip4.csv', 'utf8').trim();
		const scanCommand = `/home/100acresheater/luxminer-cli-linux-arm64 scan range ${ip} ${ip} -o minerz.csv`;

		exec(scanCommand, async (error, stdout, stderr) => {
			if (error) {
				throw error; // Throw the error to be caught by the outer try-catch
			}

			const minerData = fs.readFileSync('minerz.csv', 'utf8');
			const [miner] = csv.parse(minerData, { columns: true, skip_empty_lines: true });

			const tempCommand = `echo '{"command": "temps"}' | nc ${ip} 4028`;
			const tempData = execSync(tempCommand).toString();
			const tempJson = JSON.parse(tempData);

			const summaryCommand = `echo '{"command": "summary"}' | nc ${ip} 4028`;
			const summaryData = execSync(summaryCommand).toString();
			const summaryJson = JSON.parse(summaryData);

			let html = '<head><style>div { background: rgba(255, 255, 255, .1);font-size: 1rem;color: orange;border: 1px solid orange; border-radius: 50%; width: fit-content;display: grid;justify-content: center;align-items: center;margin: 0;aspect-ratio: 1 / 1;text-align: center;padding: 0;margin: 0;width: 7rem;height: 7rem; } body { display: flex;color: orange;font-weight: bold;margin: 0;padding: 0; }</style></head><body>';
			html += `<div>Hashrate:<br>${(summaryJson.SUMMARY[0]["GHS av"] / 1000).toFixed(2)}TH/s</div>`;
			html += `<div>Chips Frequency:<br>${miner.frequency}Mhz</div>`;
			html += `<div>Chips Temps:<br>`;
			tempJson.TEMPS.forEach(temp => {
				const avgTemp = (temp.BottomLeft + temp.BottomRight + temp.TopLeft + temp.TopRight) / 4;
				html += `ID ${temp.ID}: ${avgTemp.toFixed(2)}°C<br>`;
			});
			html += '</div></body>';

			res.send(html);
		});
	} catch (err) {
		console.error(`An error occurred: ${err.message}`);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/asicstats5.html', async (req, res) => {
	try {
		// Check if ip.csv exists
		if (!fs.existsSync('ip5.csv')) {
			return res.send(''); // Send blank response
		}
		const ip = fs.readFileSync('ip5.csv', 'utf8').trim();
		const scanCommand = `/home/100acresheater/luxminer-cli-linux-arm64 scan range ${ip} ${ip} -o minerz.csv`;

		exec(scanCommand, async (error, stdout, stderr) => {
			if (error) {
				throw error; // Throw the error to be caught by the outer try-catch
			}

			const minerData = fs.readFileSync('minerz.csv', 'utf8');
			const [miner] = csv.parse(minerData, { columns: true, skip_empty_lines: true });

			const tempCommand = `echo '{"command": "temps"}' | nc ${ip} 4028`;
			const tempData = execSync(tempCommand).toString();
			const tempJson = JSON.parse(tempData);

			const summaryCommand = `echo '{"command": "summary"}' | nc ${ip} 4028`;
			const summaryData = execSync(summaryCommand).toString();
			const summaryJson = JSON.parse(summaryData);

			let html = '<head><style>div { background: rgba(255, 255, 255, .1);font-size: 1rem;color: orange;border: 1px solid orange; border-radius: 50%; width: fit-content;display: grid;justify-content: center;align-items: center;margin: 0;aspect-ratio: 1 / 1;text-align: center;padding: 0;margin: 0;width: 7rem;height: 7rem; } body { display: flex;color: orange;font-weight: bold;margin: 0;padding: 0; }</style></head><body>';
			html += `<div>Hashrate:<br>${(summaryJson.SUMMARY[0]["GHS av"] / 1000).toFixed(2)}TH/s</div>`;
			html += `<div>Chips Frequency:<br>${miner.frequency}Mhz</div>`;
			html += `<div>Chips Temps:<br>`;
			tempJson.TEMPS.forEach(temp => {
				const avgTemp = (temp.BottomLeft + temp.BottomRight + temp.TopLeft + temp.TopRight) / 4;
				html += `ID ${temp.ID}: ${avgTemp.toFixed(2)}°C<br>`;
			});
			html += '</div></body>';

			res.send(html);
		});
	} catch (err) {
		console.error(`An error occurred: ${err.message}`);
		res.status(500).send('Internal Server Error');
	}
});
// Endpoint to get temperature reading
app.get('/temperature', (req, res) => {
	exec('python3 /home/100acresheater/temp.py', (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return res.status(500).send('Error executing temperature script');
		}

		// Format the output
		let html = `<head><style>body { color: ${getColorForTemperature(stdout)};font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; } .temp { display: grid;justify-content: center;align-items: center;border: 1px solid ${getColorForTemperature(stdout)};background: rgba(255, 255, 255, .1); border-radius: 50%; aspect-ratio: 1 / 1;box-shadow: 0 4px 8px rgba(0,0,0,0.2);font-size: 1rem;width: 10rem;height: 10rem; } </style></head><body>`;
		html += `<div class="temp">Room Temp:<br>${stdout}°F<br>${fahrenheitToCelsius(stdout)}°C</div>`;
		html += '</body>';

		res.send(html);
	});
});

app.post('/setoffset', (req, res) => {
	const offset = parseInt(req.body.offset, 10); // Parse as integer

	// Validate the offset value
	if (!isNaN(offset) && offset >= -10 && offset <= 10) {
		// Write to offset.csv
		fs.writeFile('/home/100acresheater/offset.csv', `${offset}`, (err) => {
			if (err) {
				res.status(500).send('Error writing to file');
			} else {
				res.send(`<h1>Offset set to ${offset}</h1><a href="/"><button style="background: orange;">Thermostat</button></a>`);
			}
		});
	} else {
		res.status(400).send('Invalid offset. Please provide an integer number between -5 and 5.');
	}
});

app.post('/setoffset2', (req, res) => {
	const offset = parseInt(req.body.offset, 10); // Parse as integer

	// Validate the offset value
	if (!isNaN(offset) && offset >= -10 && offset <= 10) {
		// Write to offset.csv
		fs.writeFile('/home/100acresheater/offset2.csv', `${offset}`, (err) => {
			if (err) {
				res.status(500).send('Error writing to file');
			} else {
				res.send(`<h1>Offset set to ${offset}</h1><a href="/"><button style="background: orange;">Thermostat</button></a>`);
			}
		});
	} else {
		res.status(400).send('Invalid offset. Please provide an integer number between -5 and 5.');
	}
});

app.post('/setoffset3', (req, res) => {
	const offset = parseInt(req.body.offset, 10); // Parse as integer

	// Validate the offset value
	if (!isNaN(offset) && offset >= -10 && offset <= 10) {
		// Write to offset.csv
		fs.writeFile('/home/100acresheater/offset3.csv', `${offset}`, (err) => {
			if (err) {
				res.status(500).send('Error writing to file');
			} else {
				res.send(`<h1>Offset set to ${offset}</h1><a href="/"><button style="background: orange;">Thermostat</button></a>`);
			}
		});
	} else {
		res.status(400).send('Invalid offset. Please provide an integer number between -5 and 5.');
	}
});

app.post('/clearip1', (req, res) => {
	const filePath = path.join(__dirname, 'ip1.csv');
	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error(err);
				return res.status(500).send('Error clearing IP1 data');
			}
			res.send('IP1 data cleared');
		});
	} else {
		res.send('No IP1 data to clear');
	}
});

app.post('/clearip2', (req, res) => {
	const filePath = path.join(__dirname, 'ip2.csv');
	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error(err);
				return res.status(500).send('Error clearing IP2 data');
			}
			res.send('IP2 data cleared');
		});
	} else {
		res.send('No IP2 data to clear');
	}
});

app.post('/clearip3', (req, res) => {
	const filePath = path.join(__dirname, 'ip3.csv');
	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error(err);
				return res.status(500).send('Error clearing IP3 data');
			}
			res.send('IP3 data cleared');
		});
	} else {
		res.send('No IP3 data to clear');
	}
});

app.post('/clearip4', (req, res) => {
	const filePath = path.join(__dirname, 'ip4.csv');
	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error(err);
				return res.status(500).send('Error clearing IP4 data');
			}
			res.send('IP4 data cleared');
		});
	} else {
		res.send('No IP4 data to clear');
	}
});

app.post('/clearip5', (req, res) => {
	const filePath = path.join(__dirname, 'ip5.csv');
	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error(err);
				return res.status(500).send('Error clearing IP5 data');
			}
			res.send('IP5 data cleared');
		});
	} else {
		res.send('No IP5 data to clear');
	}
});

app.get('/temp2', async (req, res) => {
	try {
		// Fetching data from the external URL using axios
		const url = fs.readFileSync('/home/100acresheater/relay1path.csv', 'utf8').trim();
		const response = await axios.get(url);
		const data = response.data;
		let html = `<head><style>body { color: ${getColorForTemperature(data)};font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; } .temp { display: grid;justify-content: center;align-items: center;border: 1px solid ${getColorForTemperature(data)};background: rgba(255, 255, 255, .1); border-radius: 50%; aspect-ratio: 1 / 1;box-shadow: 0 4px 8px rgba(0,0,0,0.2);font-size: 1rem;width: 10rem;height: 10rem; } </style></head><body>`;
		html += `<div class="temp">Room Temp:<br>${data}°F<br>${fahrenheitToCelsius(data)}°C</div>`;
		html += '</body>';

		res.send(html);
	} catch (error) {
		console.error('Error fetching data:', error);
		res.status(500).send('Error fetching data');
	}
});

app.get('/temp3', async (req, res) => {
	try {
		// Fetching data from the external URL using axios
		const url = fs.readFileSync('/home/100acresheater/relay2path.csv', 'utf8').trim();
		const response = await axios.get(url);
		const data = response.data;
		let html = `<head><style>body { color: ${getColorForTemperature(data)};font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; } .temp { display: grid;justify-content: center;align-items: center;border: 1px solid ${getColorForTemperature(data)};background: rgba(255, 255, 255, .1); border-radius: 50%; aspect-ratio: 1 / 1;box-shadow: 0 4px 8px rgba(0,0,0,0.2);font-size: 1rem;width: 10rem;height: 10rem; } </style></head><body>`;
		html += `<div class="temp">Room Temp:<br>${data}°F<br>${fahrenheitToCelsius(data)}°C</div>`;
		html += '</body>';

		res.send(html);
	} catch (error) {
		console.error('Error fetching data:', error);
		res.status(500).send('Error fetching data');
	}
});

// POST endpoint for /setrelay1ip
app.post('/setrelay1ip', (req, res) => {
	const relay1IP = `http://${req.body.ip}:3000`;
	fs.writeFile('relay1path.csv', relay1IP, (err) => {
		if (err) {
			console.error('Error writing to relay1path.csv:', err);
			res.status(500).send('Failed to save Relay 1 IP');
		} else {
			res.send(`Relay 1 IP set to ${relay1IP}`);
		}
	});
});

// POST endpoint for /setrelay2ip
app.post('/setrelay2ip', (req, res) => {
	const relay2IP = `http://${req.body.ip}:3000`;
	fs.writeFile('relay2path.csv', relay2IP, (err) => {
		if (err) {
			console.error('Error writing to relay2path.csv:', err);
			res.status(500).send('Failed to save Relay 2 IP');
		} else {
			res.send(`Relay 2 IP set to ${relay2IP}`);
		}
	});
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
