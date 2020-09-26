const vscode = require('vscode');
const WSS = require('ws').Server;
const irc = require('irc');
const { Server } = require('http');

/*
 * @param {vscode.ExtensionContext} context
 */

function Command(message) {
	let arr = message.toString().split(" ");
	arr[0] = arr[0].toLowerCase();
	return arr; 
}

function Connect(ws, ip) {
	ws.send("Connecting to " + ip)
	client = new irc.Client(ip, nick, {
		channels: [], realName: "VScode IRC", stripColors: false
	});

	//when user gets registered to a new server
	client.addListener('registered', function(message) {
		ws.send("Connected")
	});

	//when server returns a motd
	client.addListener('motd', function(motd) {
		ws.send(motd)
	});

	//when server returns a topic
	client.addListener('topic', function(channel, topic, nick, message) {
		ws.send(nick + ' => ' + channel + ': ' + topic)
	});

	//pm
	client.addListener('pm', function (from, message) {
		ws.send(from + ' => ME: ' + message);
	});

	//part
	client.addListener('part', function (channel, nick, reason, message) {
		ws.send(nick + " left " + channel + " for: " + reason);
	});

	//quit
	client.addListener('quit', function (channel, nick, reason, message) {
		ws.send(nick + " left " + channel + " for: " + reason);
	});

	//quit
	client.addListener('quit', function (channel, nick, reason, message) {
		ws.send(nick + " was kicked from " + channel + " for: " + reason);
	});

	//when channelist starts to download
	client.addListener('channellist_start', function(list) {
		_channellist = Array()
		ws.send("Downloading channellist")
	});

	//adding channelist listing to an array
	client.addListener('channellist_item', function(listing) {
		_channellist.push(listing);
	});

	//sorting and returning channelist when download is complete
	client.addListener('channellist', function(list) {
		_channellist.sort(function(a,b) {
			return a["users"]-b["users"]
		});

		list = "";
		_channellist.forEach(element => {
			list += element["name"] + " : " + element["users"] + " : " + element["topic"] + "<br>"
		});
		ws.send(list);
	});

	//ignoring errors
	client.addListener('error', function(message) {
	});

	//returning message
	client.addListener('message', function (from, to, message) {
		ws.send(from + ' => ' + to + ': ' + message);
	});
}

	//some global vars used by the client
	var client;
	var channel = "";
	var nick = "";
	var _channellist;

function activate(context) {

	vscode.commands.registerCommand('IRC.start', () => {
		const panel = vscode.window.createWebviewPanel(
			'VSIRC',
			'IRC CLIENT',
			vscode.ViewColumn.One,
			{enableScripts: true}
		);

		panel.webview.html = getWebviewContent();

		//starting a websocket server
		const wss = new WSS({ port: 8080 })

		wss.on('connection', ws => {

		//cool banner
		ws.send(
`
╔══════════════════════════════════════════════╗
║ to connect to a server type /connect IP NICK ║
║ to disconnect from a server type /disconnect ║
║ type /list for a channel list                ║
║ type /join channel to join a channel         ║
╚══════════════════════════════════════════════╝
`);



			//when user enters a message
			ws.on('message', message => {
				// 
				// Handling commands
				//

				if(message.toString().charAt(0) == "/") {
					let command = Command(message);

					if(command[0].includes("/test")) {
						ws.send("test message")
					}

					if(command[0].includes("/connect")) {
						ws.send(message)

						//pushing nick to var
						nick = command[2];
						Connect(ws, command[1])
					}

					//if user wants to join a channel
					if(command[0].includes("/join")) {
						ws.send(message)

						//disconnecting from old channel
						client.part(channel)

						//joining new channel
						client.join(command[1]);
						channel = command[1];
					}

					//if user wants to disconnect from a server
					if(command.includes("/disconnect")) {
						//connect
						ws.send(message)
						client.disconnect();
					}

					//if user wants a channel list
					if(command.includes("/list")) {
						ws.send(message)
						client.list();
					}
					
				} else {
					ws.send(nick + ' => ' + channel + ': ' + message)
					try {
						client.say(channel, message);
					} catch {
						ws.send("error: Try connecting to an irc chat first.")
					}
				}
			})
		})
	});
}

//returning faketerminal interface
function getWebviewContent() {
	return `<!--
    Todo: beutyfy HTML and JS
-->
<!doctype html>
<html>
    <head>
		<style>
			html, body {
				max-width: 100%;
				overflow-x: hidden;
			}
            body {
				margin: 0;
            }
            p {
                margin: 0px;
			}
            #terminal {
				overflow-x: hidden;
                position: absolute;
                overflow-y: auto;
                width: 100%; 
				height: 97%;
				top: 0px;
				max-width: 100%;
				word-wrap: break-word;
				margin-left: 5px;
            }
        </style>
    </head>
    <body>
		<div>
			<pre>
				<div id="terminal"> 

				</div>
			</pre>
			<input type="text" id="terminalI" style="position: absolute; bottom: 0px; width: 100%; border: 0; outline: none; background-color: rgba(255, 0, 0, 0); color: white;" value="">
        </div>
    </body>
    <script>
        const connection = new WebSocket('ws://localhost:8080')

        terminal = document.getElementById("terminal")

        connection.onmessage = e => {
			message = e.data
			var reg = /([#][a-zA-Z0-9\d\\-\\_\\.\\|\\=\\!\\+\\#\\'\\[\\]\\/]+) /g;
			matches = message.match(reg)
			if(Array.isArray(matches)) {
				matches.forEach(match => {
					message = message.replace(match, "<a href='no-javascript.html' onclick='join(\\"" + match.trim() + "\\")'>" + match.trim() + "</a> ")
				});
			}
            terminal.innerHTML += "<p>" + message + "</p>"
            terminal.scrollTop = terminal.scrollHeight
        }

        function join(channel) {
            terminali.value = "/join " + channel
        }

        connection.onerror = error => {
            terminal.innerHTML += "<p>Terminal Error, please restart application</p>"
        }

        terminali = document.getElementById("terminalI")

        terminali.focus();
        terminali.select();

        terminal.onclick = function(e) {
            terminali.focus();
            terminali.select();
        }

        document.getElementById('terminalI').onkeypress = function(e){
            if (!e) e = window.event;
            var keyCode = e.keyCode || e.which;
            if (keyCode == '13'){
				// Enter pressed
				if(terminali.value == "/clear") {
                    terminal.innerHTML= "";
                } else {
                    connection.send(terminali.value);	
				}
				terminali.value = "";
                return false;
            }
        }
    </script>
</html>`;
}


exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
