function database(uid){
  var xhr = new XMLHttpRequest();
  // Setup our listener to process completed requests
  xhr.onreadystatechange = () => {

  // Process our return data
  if (xhr.status >= 200 && xhr.status < 300) {
    // This will run when the request is successful
    console.log('success!', xhr);
  } else {
    // This will run when it's not
    console.log('The request failed!');
    }
  };

  xhr.open('GET', `/salvador`, true);
  xhr.send();
}