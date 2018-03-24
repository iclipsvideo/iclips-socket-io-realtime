// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';


server.listen(port, ip);
console.log('Bus Tracker Server is running since ' + getDateTime()+ 'http://%s:%s', ip, port);

// Routing
app.get('/', function (req, res) {
	res.send('Hello ' + req.headers['user-agent']);
})

/*================ FANCTIONS START ===========================*/
function removeClient(ws) {
	//remove from client list
	for (i = 0; i < ListOfClients.length; i++) {
		if (ListOfClients[i].socket === ws) {
			var u = ListOfClients[i].username;
			ListOfClients.splice(i, 1);

			var m = "client is disconnected: " + u;

			log(m);
		}
	}
	
	//remove from bus id list
	for (i = 0; i < bus_id_list.length; i++) {
		if (bus_id_list[i].username === username && bus_id_list[i].id == bus_id) {
			bus_id_list.splice(i, 1);
		}
	}
}

function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + " " + hour + ":" + min + ":" + sec;

}

var isEqual = function (value, other) {

	// Get the value type
	var type = Object.prototype.toString.call(value);

	// If the two objects are not the same type, return false
	if (type !== Object.prototype.toString.call(other)) return false;

	// If items are not an object or array, return false
	if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

	// Compare the length of the length of the two items
	var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
	var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
	if (valueLen !== otherLen) return false;

	// Compare two items
	var compare = function (item1, item2) {

		// Get the object type
		var itemType = Object.prototype.toString.call(item1);

		// If an object or array, compare recursively
		if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
			if (!isEqual(item1, item2)) return false;
		}

		// Otherwise, do a simple comparison
		else {

			// If the two items are not the same type, return false
			if (itemType !== Object.prototype.toString.call(item2)) return false;

			// Else if it's a function, convert to a string and compare
			// Otherwise, just compare
			if (itemType === '[object Function]') {
				if (item1.toString() !== item2.toString()) return false;
			} else {
				if (item1 !== item2) return false;
			}

		}
	};

	// Compare properties
	if (type === '[object Array]') {
		for (var i = 0; i < valueLen; i++) {
			if (compare(value[i], other[i]) === false) return false;
		}
	} else {
		for (var key in value) {
			if (value.hasOwnProperty(key)) {
				if (compare(value[key], other[key]) === false) return false;
			}
		}
	}

	// If nothing failed, return true
	return true;

};

var numUsers = 0;
var usernames = [];
var ListOfClients = [];
var bus_id_list = [];

io.on('connection', function (socket) {
	console.log("User joined: " + socket.id);

	// when the client emits 'new message', this listens and executes
	socket.on('message', function (data) {
		var o = JSON.parse(data);
		var action = o.action;
		var message = o.message;
		var username = o.username;

		console.log("message: " + message + ". from: " + username + ". action: " + action);
		
		switch (action) {
			case "get bus list":
				//make string list ( + "$" + bus_id_list[i].lat + "$" + bus_id_list[i].lng)
				var strList = "@"; 
				for (i = 0; i < bus_id_list.length; i++) {
					strList += bus_id_list[i].id + "|";
				}
				
				if (strList === '@') {
					ws.send('No busses available for tracking.');
				} else {
					ws.send(strList);
				}
				
				log("Bus ID list sent to " + username + ". List: " + strList);
				break;
			
			case "set bus id":
				bus_id = json.id;
				
				var client = {
					id: json.id,
					lat: json.lat,
					lng: json.lng,
					username: username
				};

				//ID is unique for each bus
				var can_add = true;
				for (i = 0; i < bus_id_list.length; i++) {
					if (bus_id_list[i].id === json.id) {
						can_add = false;
						break;
					}
				}
				if (can_add) {
					bus_id_list.push(client);
					
					//keep the initial socket connection in client list 
					for (i = 0; i < ListOfClients.length; i++) {
						if (ListOfClients[i].socket === ws) {
							ListOfClients[i].is_bus = true;

							var m = "Bus (" + json.id + ") is ready for tracking.";

							log(m);
						}
					}
					
					var m = "Bus tracking enabled successfully. Bus ID: " + json.id;
				
					log(json.message);
					
					// Send to current client
					ws.send(m);
				} else {
					var m = "The bus ID "+ json.id + " is already enabled for tracking. Choose a different and unique ID to enable tracking.";
				
					// Send to current client
					ws.send(m);
				}
				
				break;
				
			case "get bus location":
				for (i = 0; i < ListOfClients.length; i++) {
					if (ListOfClients[i].socket === ws) {
						ListOfClients[i].track_bus = json.bus_id;

						log(json.message);

						ws.send('Bus ID added successfully for tracking.');
					}
				}
				break;
			
			case "broadcast location":
				//update all clients with bus location
				for (i = 0; i < ListOfClients.length; i++) {
					if (ListOfClients[i].track_bus === json.id) {
						ListOfClients[i].socket.send("$" + "|" + json.id + "|" + json.lat + "|" + json.lng);
					}
				}
				break;
			}
		});

	socket.on('add user', function (username) {
		//we have to make sure the this list always contains only one reference to the user
		var client = {	
			username: username,
			socket: socket,
			is_bus: false,
			track_bus: null
		};
		ListOfClients.push(client);
		
		
		var m = "Welcome to Bus Tracker " + username + ". Tap on Find A Bus to request a list of all available busses. If the request is successfull tap on a bus to request its location.";
	
		// Send to current client
		socket.emit('user added', {
			message: m
		});
	});

	socket.on('disconnect', function () {
		if (addedUser) {
			--numUsers;

			// echo globally that this client has left
			socket.broadcast.emit('user left', {
				username: socket.username,
				numUsers: numUsers
			});
		}
	});
});