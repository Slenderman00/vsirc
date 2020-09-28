const vscode = require('vscode');
const WSS = require('ws').Server;
const irc = require('irc');

function Command(message) {
	let arr = message.toString().split(" ");
	arr[0] = arr[0].toLowerCase();
	return arr; 
}

function Connect(ws, ip) {
	send("Connecting to " + ip, ws)
	client = new irc.Client(ip, nick, {
		channels: [], realName: "VSIRC", stripColors: false
	});

	//when user gets registered to a new server
	client.addListener('registered', function(message) {
		send("Connected", ws)
	});

	//when server returns a motd
	client.addListener('motd', function(motd) {
		send(motd, ws)
	});

	//when server returns a topic
	client.addListener('topic', function(channel, topic, nick, message) {
		send(nick + ' => ' + channel + ': ' + topic, ws)
	});

	//part
	client.addListener('part', function (channel, nick, reason, message) {
		send(nick + " left " + channel + " for: " + reason, ws);
	});

	//quit
	client.addListener('quit', function (nick, reason, channels, message) {
		send(nick + " left for: " + reason, ws);
	});

	//kick
	client.addListener('kick', function (channel, nick, by, reason, message) {
		send(nick + " was kicked from" + channel + " by " + by +  "for: " + reason, ws);
	});

	//when channelist starts to download
	client.addListener('channellist_start', function(list) {
		_channellist = Array()
		send("Downloading channellist", ws)
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
		send(list, ws);
	});

	//ignoring errors
	client.addListener('error', function(message) {
	});

	//returning message
	client.addListener('message', function (from, to, message) {
		send(from + ' => ' + to + ': ' + message, ws);
	});
}

	//some global vars used by the client
	var client;
	var channel = "";
	var nick = "";
	var _channellist;
	var chat = [];
	var _port;

function randport() {
	var num = 8050 + Math.floor(Math.random() * 100);
	return num;
}

function activate(context) {
	vscode.commands.registerCommand('VSIRC.start', () => {
		const panel = vscode.window.createWebviewPanel(
			'VSIRC',
			'IRC CLIENT',
			vscode.ViewColumn.Two,
			{enableScripts: true}
		);

		_port = randport()
		panel.webview.html = getWebviewContent();

		//starting a websocket server
		const wss = new WSS({ port: _port })

		wss.on('connection', ws => {
			start(ws, context);
			fetch(ws);
		})
	})
}

function send(message, ws) {
	ws.send(message)
	chat.push(message)
}

function fetch(ws) {
	chat.forEach(message => {
		ws.send(message)
	});
}

function start(ws, context) {
	//cool banner
	ws.send(
`
╔══════════════════════════════════════════════╗
║ to connect to a server type /connect IP NICK ║
║ to disconnect from a server type /disconnect ║
║ type /list for a channel list                ║
║ type /join channel to join a channel         ║
║ type /last to connect to last server         ║
╚══════════════════════════════════════════════╝
`);
	//when user enters a message
	ws.on('message', message => {
		// 
		// Handling commands
		//

		if(message.toString().charAt(0) == "/") {
			let flag = true;

			let command = Command(message);

			if(command[0].includes("/test")) {
				flag = false;
				send(message, ws);
				send("test message", ws);
			}

			if(command[0].includes("/connect")) {
				flag = false;
				send(message, ws);

				//pushing nick to global var
				nick = command[2];
				Connect(ws, command[1])

				context.globalState.update("ip", command[1]);				
				context.globalState.update("nick", command[2]);
			}

			if(command[0].includes("/last")) { 
				flag = false;
				send(message, ws);

				nick = context.globalState.get('nick', '');
				let ip = context.globalState.get('ip', '');

				if(ip == "" || nick == "") {
					send("No last server", ws)
				} else {
					Connect(ws, ip)
				}
			}


			//if user wants to join a channel
			if(command[0].includes("/join")) {
				flag = false;
				send(message, ws);
				send("connecting to " + command[1], ws);

				//disconnecting from old channel
				client.part(channel)

				//joining new channel
				client.join(command[1]);
				channel = command[1];
			}

			//if user wants to disconnect from a server
			if(command.includes("/disconnect")) {
				flag = false;
				//connect
				send(message, ws);
				client.disconnect();
			}

			//if user wants a channel list
			if(command.includes("/list")) {
				flag = false;
				send(message, ws);
				client.list();
			}

			if(flag) {
				send(nick + ' => ' + channel + ': ' + message, ws)
				client.say(channel, message);
			}
			
		} else {
			send(nick + ' => ' + channel + ': ' + message, ws)
			try {
				client.say(channel, message);
			} catch {
				send("error: Try connecting to an irc chat first.", ws);
			}
		}
	})
}

//returning faketerminal interface
function getWebviewContent() {

	// move content to external html
	return `<!--
    Todo: Redo
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
        const connection = new WebSocket('ws://localhost:` + _port + `')

        terminal = document.getElementById("terminal")

        connection.onmessage = e => {
			message = e.data
			var reg = /([#][a-zA-Z0-9\d\\-\\_\\.\\|\\=\\?\\-\\\\!\\*\\(\\)\\+\\#\\'\\[\\]\\/]+) /g;
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
