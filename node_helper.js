'use strict';

/* Magic Mirror
 * Module: MMM-PIR-Sensor
 *
 * By Paul-Vincent Roll http://paulvincentroll.com
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const Gpio = require('onoff').Gpio;
const exec = require('child_process').exec;

module.exports = NodeHelper.create({
  start: function () {
    this.started = false;
  },

  activateMonitor: function () {
	  const self = this;
	  console.log("[" + self.name + "] activateMonitor");
    if (this.config.relayPIN != false) {
      this.relay.writeSync(this.config.relayOnState);
    }
    else if (this.config.relayPIN == false){
      // Check if hdmi output is already on
      exec("/opt/vc/bin/tvservice -s").stdout.on('data', function(data) {
	      
	  console.log("[" + self.name + "] activateMonitor "+data);
        if (data.indexOf("0x120002") !== -1){
	        console.log("[" + self.name + "] activateMonitor tvservice");
			exec("/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7", null);
        }
      });
    }
  },

  deactivateMonitor: function () {
	  const self = this;
	  console.log("[" + self.name + "] deactivateMonitor");
    if (this.config.relayPIN != false) {
      this.relay.writeSync(this.config.relayOffState);
    }
    else if (this.config.relayPIN == false){
	  console.log("[" + self.name + "] deactivateMonitor tvservice");
      exec("/opt/vc/bin/tvservice -o", null);
    }
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'CONFIG' && this.started == false) {
      const self = this;
      this.config = payload;

      // Setup value which represent on and off
      const valueOn = this.config.invertSensorValue ? 0 : 1;
      const valueOff = this.config.invertSensorValue ? 1 : 0;

      //Setup pins
      this.pir = new Gpio(this.config.sensorPIN, 'in', 'both');
      
      console.log("[" + self.name + "] " + this.pir);
      
      // exec("echo '" + this.config.sensorPIN.toString() + "' > /sys/class/gpio/export", null);
      // exec("echo 'in' > /sys/class/gpio/gpio" + this.config.sensorPIN.toString() + "/direction", null);

      if (this.config.relayPIN) {
        this.relay = new Gpio(this.config.relayPIN, 'out');
        this.relay.writeSync(this.config.relayOnState);
        exec("/opt/vc/bin/tvservice --preferred && sudo chvt 6 && sudo chvt 7", null);
      }

      //Detected movement
      this.pir.watch(function(err, value) {
	     console.log("[" + self.name + "] " + value);
	      
        if (value == valueOn) {
          self.sendSocketNotification("USER_PRESENCE", true);
          if (self.config.powerSaving){
            clearTimeout(self.deactivateMonitorTimeout);
            self.activateMonitor();
          }
        }
        else if (value == valueOff) {
          self.sendSocketNotification("USER_PRESENCE", false);
          if (!self.config.powerSaving){
            return;
          }

          self.deactivateMonitorTimeout = setTimeout(function() {
            self.deactivateMonitor();
          }, self.config.powerSavingDelay * 1000);
        }
      });

      this.started = true;

    } else if (notification === 'SCREEN_WAKEUP') {
      this.activateMonitor();
    }
  }

});
