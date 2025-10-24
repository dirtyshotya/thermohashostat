import json
import subprocess
import sys
import os
import requests

def get_profiles(ip):
    command = f"echo '{{\"command\": \"profiles\"}}' | nc {ip} 4028 | jq"
    result = subprocess.run(command, capture_output=True, shell=True, text=True)
    if result.returncode != 0:
        print("Error fetching profiles:", result.stderr)
        sys.exit(1)
    return json.loads(result.stdout)

def sort_profiles_by_frequency(profiles):
    return sorted(profiles, key=lambda x: x['Frequency'])

def afterburner_exists():
    return os.path.exists("/home/100acresheater/AFTERBURNER")

def get_afterburner_profile(sorted_profiles, room_temp, target_temp):
    default_profile = next((p for p in sorted_profiles if p['Profile Name'] == 'default'), None)
    if default_profile is None:
        # Handle the case where there is no default profile
        return None

    default_index = sorted_profiles.index(default_profile)

    # If the room is colder than the target, and there's a higher frequency profile available
    if room_temp < target_temp and default_index + 1 < len(sorted_profiles):
        return sorted_profiles[default_index + 1]['Profile Name']
    else:
        return default_profile['Profile Name']

def determine_profile_name(room_temp, target_temp, profiles):
    sorted_profiles = sort_profiles_by_frequency(profiles)
    lowest_profile = sorted_profiles[0]
    default_profile = next((p for p in profiles if p['Profile Name'] == 'default'), None)

    # Ensure there is a default profile
    if not default_profile:
        return None

    default_index = sorted_profiles.index(default_profile)
    lowest_index = sorted_profiles.index(lowest_profile)

    temp_diff = target_temp - room_temp
    index_range = default_index - lowest_index
    quarter_index = lowest_index + index_range // 4
    middle_index = lowest_index + index_range // 2
    three_quarter_index = lowest_index + 3 * index_range // 4

    if temp_diff <= 0:
        selected_profile = lowest_profile['Profile Name']
    elif 0 < temp_diff <= 1.875:
        selected_profile = sorted_profiles[quarter_index]['Profile Name']
    elif 1.875 < temp_diff <= 3.75:
        selected_profile = sorted_profiles[middle_index]['Profile Name']
    elif 3.75 < temp_diff <= 5.625:
        selected_profile = sorted_profiles[three_quarter_index]['Profile Name']
    else:
        selected_profile = default_profile['Profile Name']

    # Apply AFTERBURNER tuning if file exists and room temperature is below target temperature
    if afterburner_exists() and room_temp < target_temp:
        selected_profile = get_afterburner_profile(sorted_profiles, room_temp, target_temp)

    return selected_profile

def get_room_temperature():
    result = subprocess.run(["python3", "/home/100acresheater/temp.py"], capture_output=True, text=True)
    return float(result.stdout.strip())

def get_room2_temperature():
    try:
        with open('/home/100acresheater/relay1path.csv', 'r') as file:
            # Read the first line of the file, which is the URL
            link = file.readline().strip()

            # Make a request to the URL
            response = requests.get(link)
            response.raise_for_status()  # This will raise an exception for HTTP errors

            return response.text
    except IOError as e:
        return f"File error: {e}"
    except requests.RequestException as e:
        return f"Request error: {e}"
    except Exception as e:
        return f"An error occurred: {e}"

def get_room3_temperature():
    try:
        with open('/home/100acresheater/relay2path.csv', 'r') as file:
            # Read the first line of the file, which is the URL
            link = file.readline().strip()

            # Make a request to the URL
            response = requests.get(link)
            response.raise_for_status()  # This will raise an exception for HTTP errors

            return response.text
    except IOError as e:
        return f"File error: {e}"
    except requests.RequestException as e:
        return f"Request error: {e}"
    except Exception as e:
        return f"An error occurred: {e}"

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
    if len(sys.argv) < 3:
        print("Usage: python script.py <IP_ADDRESS> <ZONE>")
        sys.exit(1)

    ip_address = sys.argv[1]
    zone = sys.argv[2]
    profiles_data = get_profiles(ip_address)

    # Determine the room temperature based on the zone
    if zone == '1':
        room_temp = get_room_temperature()
    elif zone == '2':
        room_temp = float(get_room2_temperature())
    elif zone == '3':
        room_temp = float(get_room3_temperature())
    else:
        print("Invalid zone specified. Please use '1', '2', or '3'.")
        sys.exit(1)

    target_temp = get_target_temperature(zone)

    profile_name = determine_profile_name(room_temp, target_temp, profiles_data["PROFILES"])
    print(f"{profile_name}")

if __name__ == "__main__":
    main()
