var consul = require('consul')({"host": "consul"});
var deepEqual = require('deep-equal');
var ejs = require('ejs');
var read = require('fs').readFileSync
var write = require('fs').writeFileSync
var join = require('path').join
var spawn = require('child_process').spawn

var nginxConfigPath = "/etc/nginx/nginx.conf"
var checkFrequency = 10000;
var nginxConfTemplate = 'configs/nginx.ejs';
var nginxStr = read(join(__dirname, nginxConfTemplate), 'utf8'); 
var baseNginxConf = read(join(__dirname, 'configs/nginx.conf'), 'utf8');
var lock = false;
var configServices = {};

function findHealthyServices(service, cb) {
	consul.health.service(service, function(err, result) {
		var services = []
		if (err) throw err;
		if (result.length === 0) {
			//do something if you want
		} else {
			result.forEach(function(service){
			  if (service.Checks[0].Status === "passing") {
				  services.push(service.Service)
			    }
		    });
		}
		cb(null, services);
	});
}

function createNginxConfig(services) {
	var ret = ejs.compile(nginxStr)({"services": services});
	return ret;
}

function writeNginxConfig(config) {
	write(nginxConfigPath, config);
}

function restartNginx() {
	spawn('pkill', ["-SIGHUP", "nginx"]).stdout.on('data', function (data) {
			console.log('restartNginx: ' + data);
	});
}

setInterval(function queryConsul(){
	if (lock === true) return;
	lock = true;
	
	findHealthyServices("api", function(err, result) {
		if (err) {
			lock = false;
			return;
		}
		if (!deepEqual(configServices, result)) {
			if (result.length === 0) {
				console.log(baseNginxConf);
				configServices = result;
				lock = false;
				return;
			}
			var config = createNginxConfig(result);
			writeNginxConfig(config);
			restartNginx();
			console.log(config);
		}
		configServices = result;
		lock = false;
	});
}, checkFrequency);
