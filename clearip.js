document.getElementById('clearIp1').addEventListener('click', function() {
    sendPostRequest('/clearip1');
});

document.getElementById('clearIp2').addEventListener('click', function() {
    sendPostRequest('/clearip2');
});

document.getElementById('clearIp3').addEventListener('click', function() {
    sendPostRequest('/clearip3');
});

document.getElementById('clearIp4').addEventListener('click', function() {
    sendPostRequest('/clearip4');
});

document.getElementById('clearIp5').addEventListener('click', function() {
    sendPostRequest('/clearip5');
});


function sendPostRequest(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            var status = xhr.status;
            if (status === 0 || (status >= 200 && status < 400)) {
                // The request has been completed successfully
                console.log(xhr.responseText);
            } else {
                // Oh no! There has been an error with the request!
                console.error('Error:', xhr.statusText);
            }
        }
    };

    xhr.send();
}


