#!/bin/bash

if [ ! -f "/home/100acresheater/l.txt" ]; then
    cat /sys/class/net/eth0/address > /home/100acresheater/l.txt
elif [ `cat /home/100acresheater/l.txt` != `cat /sys/class/net/eth0/address` ]; then
    exit 1
fi

# Initialize success and failure tallies
session_success=0
session_failure=0
tuning_success=0
tuning_failure=0
fan_success=0
fan_failure=0

# Associative array to store the last successful profile for each miner
declare -A last_successful_profile

tune_s9_miner() {
    local miner_ip=$1
    local miner_index=$2
    local miner_zone=$3

    # Run the Python script to get JSON settings for the S9 miner
    s9_json=$(python3 /home/100acresheater/s9eff.py "$miner_zone")
    echo $s9_json
    frequency=$(echo "$s9_json" | jq -r '.frequency')
    voltage=$(echo "$s9_json" | jq -r '.voltage')
    fan_speed=$(echo "$s9_json" | jq -r '.fan_speed')

    if [ "${last_successful_profile[$miner_ip]}" == "$s9_json" ]; then
        echo "Profile $profile_name already set for IP $miner_ip. Skipping."
        return 0
    fi
    # Paths for the original and updated miners files
    miners_file="/home/100acresheater/miners${miner_index}.csv"
    updated_miners_file="/home/100acresheater/miners_updated${miner_index}.csv"

    # Scan the miner and create/update the miners file
    /home/100acresheater/luxminer-cli-linux-arm64 scan range $miner_ip $miner_ip -o $miners_file

    # Read, modify, and write the updated miners settings
    head -n 1 $miners_file > $updated_miners_file
    luxpart=`grep ,luxos, $miners_file | cut -d ',' -f 1-5`
    echo -e "$luxpart,$voltage,$frequency,$(grep ,luxos, $miners_file | cut -d ',' -f 8-)" >> $updated_miners_file

    # Apply the new configuration with Luxor CLI
    /home/100acresheater/luxminer-cli-linux-arm64 config write voltage frequency -i $updated_miners_file --yes
    
    #Check if successful
    if [ $? -eq 0 ]; then
        last_successful_profile[$miner_ip]=$s9_json
    fi

    # Open a session for fan settings
    local fan_session
    fan_session=$(echo '{"command": "logon"}' | nc $miner_ip 4028 | jq -r '.SESSION[0].SessionID')
    if [ -z "$fan_session" ]; then
        echo "Error: Unable to obtain fan session ID for IP $miner_ip"
        return 1
    fi

    # Set fan speed
    local fan_response
    fan_response=$(echo "{\"command\": \"fanset\", \"parameter\":\"$fan_session,$fan_speed\"}" | nc $miner_ip 4028 | jq)
    if [ -z "$fan_response" ]; then
        echo "Error: Unable to set fan speed for IP $miner_ip"
        ((fan_failure++))
        return 1
    else
        echo "Fan speed set successfully for IP $miner_ip"
        ((fan_success++))
    fi

    # Close the fan settings session
    echo '{"command": "kill"}' | nc $miner_ip 4028
}

# Function to control an individual miner
control_miner() {
    local IP=$1
    local profile_name=$2
    local fan_speed=$3
    local min_fans=${4:-0} # Default to 0 if not provided

    # Check if the profile is the same as the last successful one
    if [ "${last_successful_profile[$IP]}" == "$profile_name" ]; then
        echo "Profile $profile_name already set for IP $IP. Skipping."
        return 0
    fi

    # Kill any existing session
    echo '{"command": "kill"}' | nc $IP 4028

    # Logon and get session ID
    local SESSION
    SESSION=$(echo '{"command": "logon"}' | nc $IP 4028 | jq -r '.SESSION[0].SessionID')
    if [ -z "$SESSION" ]; then
        echo "Error: Unable to obtain session ID for IP $IP"
        ((session_failure++))
        return 1
    else
        ((session_success++))
    fi

    # Set profile for each of the first three hashboards
    for hashboard in 0 1 2; do
        local response
        response=$(echo "{\"command\": \"profileset\", \"parameter\":\"$SESSION,$hashboard,$profile_name\"}" | nc $IP 4028 | jq)
        if [ -z "$response" ]; then
            echo "Error: Unable to set profile for hashboard $hashboard at IP $IP"
            ((tuning_failure++))
        else
            ((tuning_success++))
        fi
    done

    # Set fan speed and minimum fans
    local fan_response
    fan_response=$(echo "{\"command\": \"fanset\", \"parameter\":\"$SESSION,$fan_speed,$min_fans\"}" | nc $IP 4028 | jq)
    if [ -z "$fan_response" ]; then
        echo "Error: Unable to set fan speed for IP $IP"
        ((fan_failure++))
    else
        ((fan_success++))
    fi

    # End the session
    echo '{"command": "kill"}' | nc $IP 4028
    last_successful_profile[$IP]=$profile_name
}

# Function to determine the profile for a miner
determine_profile_for_miner() {
    local miner_ip=$1
    local miner_zone=$2
    python3 /home/100acresheater/eff.py "$miner_ip" "$miner_zone" 2>/dev/null
}

# Main loop
while :; do
    # Check if AFTERBURNER file exists
    FANSPEED=-1
    if [ -f "/home/100acresheater/AFTERBURNER" ]; then
        FANSPEED=100
    fi

    # Iterate over up to 5 miners
    for i in {1..5}; do
	if [ "$i" -lt 4 ]; then
	    zone=1
	elif [ "$i" -eq 4 ]; then
	    zone=2
	elif [ "$i" -eq 5 ]; then
	    zone=3
	fi

        miner_ip_file="/home/100acresheater/ip${i}.csv"
        if [ -f "$miner_ip_file" ]; then
            miner_ip=$(cat "$miner_ip_file")
            if [ -n "$miner_ip" ]; then
                if [ `python3 /home/100acresheater/isS9.py $miner_ip 2>/dev/null` -eq 1 ]; then
                    tune_s9_miner "$miner_ip" "$i" "$zone"
                else
                    profile_name=$(determine_profile_for_miner "$miner_ip" "$zone")
                    if [ -z "$profile_name" ]; then
                        echo "Error: Unable to determine profile for miner $i at $miner_ip in zone $zone."
                        continue
                    fi

                    # Apply the profile to the miner
                    if ! control_miner "$miner_ip" "$profile_name" "$FANSPEED" "1"; then
                        echo "Error: Failed to apply profile for miner $i at $miner_ip in zone $zone."
                    fi
                fi
            else
                echo "Error: IP address not found for miner $i in zone $zone."
            fi
        else
            echo "No IP configuration file found for miner $i in zone $zone."
        fi
    done

    # Display tallies
    echo "Session Success: $session_success, Session Failure: $session_failure"
    echo "Tuning Success: $tuning_success, Tuning Failure: $tuning_failure"
    echo "Fan Set Success: $fan_success, Fan Set Failure: $fan_failure"
    sleep 3
done


