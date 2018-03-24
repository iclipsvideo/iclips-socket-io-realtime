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
	res.send('Welcome ' + req.headers['user-agent']);
})

/*================ FUNCTIONS START ===========================*/

function removeClient(ws) {
	//remove from client list
	for (i = 0; i < ListOfClients.length; i++) {
		if (ListOfClients[i].socket === ws) {
			ListOfClients.splice(i, 1);

			var m = ListOfClients[i].username + " is disconnected.";

			console.log(m);
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

/*================ FUNCTIONS END =============================*/

var numUsers = 0;
var ListOfClients = [];
var bus_id_list = [];

io.on('connection', function (socket) {
	
	socket.on('set bus id', function (id_bus) {
		//ID is unique for each bus
		var can_add = true;
		for (i = 0; i < bus_id_list.length; i++) {
			if (bus_id_list[i].id === id_bus) {
				can_add = false;
				break;
			}
		}
		
		if (can_add) {
			bus_id_list.push(id_bus);
			//keep the initial socket object in client list 
			for (i = 0; i < ListOfClients.length; i++) {
				if (ListOfClients[i].socket === socket) {
					ListOfClients[i].is_bus = true;

					var m = "Bus (" + json.id + ") is ready for tracking.";

					console.log(m);
				}
			}
			
			var m = "Bus tracking enabled successfully. Bus ID: " + json.id;
		} else {
			var m = "The bus ID "+ json.id + " is already on the system. Choose a different and unique ID to enable tracking.";
		}
		
		socket.emit('message', m);
	});
	
	socket.on('broadcast location', function (loc) {
		var json = JSON.parse(loc);
		//update all clients with bus location
		for (i = 0; i < ListOfClients.length; i++) {
			if (ListOfClients[i].track_bus === json.id) {
				ListOfClients[i].socket.emit('set bus location', json.id + '|' + json.lat + '|' + json.lng);
			}
		}
		socket.emit('bus location updated', "");
	});
	
	socket.on('request bus location', function (id_bus) {
		for (i = 0; i < ListOfClients.length; i++) {
			if (ListOfClients[i].socket === socket) {
				ListOfClients[i].track_bus = id_bus;

				socket.emit('message', 'Bus ID ' + id_bus + ' is being tracked successfully.');
			}
		}
	});
	
	socket.on('get bus list', function (message) {
		var busses = [];

		//populate the list and emit back when done
		var response = '';
		for (i = 0; i < bus_id_list.length; i++) {
			if (bus_id_list[i].id) {
				response += bus_id_list[i].id + '|';
			}
		}
		
		if (typeof array != "undefined" && array != null 
				&& array.length != null && array.length > 0) {
			socket.emit('set bus list', busses);
		} else {
			socket.emit('message', 'There is currently no busses available for tracking.');
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
		socket.emit('message', m);
		
		console.log('The following message was sent to one client. ' + m);
	});

	socket.on('disconnect', function () {
		if (addedUser) {
			--numUsers;

			removeClient(socket);
		}
	});
});