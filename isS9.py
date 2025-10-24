import subprocess
import sys
import json

def is_s9(ip):
    try:
        # Construct and execute the command
        command = f"echo '{{\"command\": \"devdetails\"}}' | nc {ip} 4028"
        result = subprocess.run(command, shell=True, check=True, stdout=subprocess.PIPE, universal_newlines=True)
        
        # Parse the output to JSON
        data = json.loads(result.stdout)
        
        # Check each device
        for device in data['DEVDETAILS']:
            if "S9" in device['Model']:
                return 1
        return 0
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 0
    except json.JSONDecodeError as e:
        print(f"JSON Error: {e}", file=sys.stderr)
        return 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python isS9.py <ip>")
        sys.exit(1)

    ip = sys.argv[1]
    result = is_s9(ip)
    print(result)

