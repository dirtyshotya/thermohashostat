import glob
import time

# Path where the Raspberry Pi exposes the 1-Wire devices
base_dir = '/sys/bus/w1/devices/'

def read_temp_raw(sensor_id):
    with open(base_dir + sensor_id + '/w1_slave', 'r') as file:
        return file.readlines()

def read_temp(sensor_id):
    lines = read_temp_raw(sensor_id)
    while lines[0].strip()[-3:] != 'YES':
        time.sleep(0.2)
        lines = read_temp_raw(sensor_id)
    equals_pos = lines[1].find('t=')
    if equals_pos != -1:
        temp_string = lines[1][equals_pos + 2:]
        temp_c = float(temp_string) / 1000.0
        return temp_c

def convert_to_fahrenheit(celsius):
    return celsius * 9.0 / 5.0 + 32

def find_sensor_id():
    # This function assumes that you have only one 1-Wire device connected (the DS18B20)
    for device_folder in glob.glob(base_dir + '28*'):
        return device_folder.split('/')[-1]

# Main execution
if __name__ == '__main__':
    sensor_id = find_sensor_id()
    if sensor_id:
        temperature_c = read_temp(sensor_id)
        temperature_f = convert_to_fahrenheit(temperature_c)
        print(f"{temperature_f:.2f}")
    else:
        print("DS18B20 sensor not found. Please check the connection.")

