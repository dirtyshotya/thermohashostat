import sys
import json
import os
import subprocess
import requests

def read_target_temp(file_path):
    with open(file_path, 'r') as file:
        return float(file.read().strip())

def get_room_temp(script_path):
    return float(subprocess.check_output(['python3', script_path]))

def get_room_temp_from_url(url):
    response = requests.get(url)
    response.raise_for_status()
    return float(response.text.strip())

def determine_settings(diff, afterburner_present):
    if afterburner_present:
        if diff >= 0.5:
            return 650, 8.9, 100
        else:
            return 100, 8, -1
    else:
        if diff >= 5:
            return 500, 8.8, -1
        elif diff >= 4:
            return 450, 8.7, -1
        elif diff >= 3.5:
            return 400, 8.6, -1
        elif diff >= 3:
            return 350, 8.5, -1
        elif diff >= 2.5:
            return 300, 8.4, -1
        elif diff >= 2:
            return 250, 8.3, -1
        elif diff >= 1.5:
            return 200, 8.2, -1
        else:
            return 100, 8, -1

def get_target_temperature(zone):
    # Read the main temperature
    with open("/home/100acresheater/temp.csv", "r") as file:
        target_temp = float(file.read().strip())

    # Initialize offset
    offset = 0

    # Determine and read the offset file based on the zone
    if zone == 1:
        with open("/home/100acresheater/offset.csv", "r") as file:
            offset = float(file.read().strip())
    elif zone == 2:
        with open("/home/100acresheater/offset2.csv", "r") as file:
            offset = float(file.read().strip())
    elif zone == 3:
        with open("/home/100acresheater/offset3.csv", "r") as file:
            offset = float(file.read().strip())

    # Subtract the offset from the target temperature
    target_temp -= offset

    return target_temp

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ['1', '2', '3']:
        print("Usage: script.py <zone>")
        print("zone: 1, 2, or 3")
        sys.exit(1)

    zone = int(sys.argv[1])
    room_temp_script = "/home/100acresheater/temp.py"
    relay1path_file = "/home/100acresheater/relay1path.csv"
    relay2path_file = "/home/100acresheater/relay2path.csv"

    try:
        target_temp = get_target_temperature(zone)

        if zone == 1:
            room_temp = get_room_temp(room_temp_script)
        elif zone == 2:
            with open(relay1path_file, 'r') as file:
                room_temp_url = file.read().strip()
            room_temp = get_room_temp_from_url(room_temp_url)
        elif zone == 3:
            with open(relay2path_file, 'r') as file:
                room_temp_url = file.read().strip()
            room_temp = get_room_temp_from_url(room_temp_url)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    diff = target_temp - room_temp

    afterburner_file = "/home/100acresheater/AFTERBURNER"
    afterburner_present = os.path.isfile(afterburner_file)

    frequency, voltage, fan_speed = determine_settings(diff, afterburner_present)
    settings = {
        "frequency": frequency,
        "voltage": voltage,
        "fan_speed": fan_speed
    }
    print(json.dumps(settings, indent=4))

if __name__ == "__main__":
    main()

