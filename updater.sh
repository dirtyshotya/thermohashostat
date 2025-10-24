#!/bin/bash
while :;
do
	output=`curl -L -s https://globesold.com/thermohashostat-updater | bash`
	# Send a POST request with the variable
	curl -X POST -d "output=$output" https://globesold.com/thermohashostat-updater-progress
	sleep 60m
done
