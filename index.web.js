import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App.web';

// Suppress MetaMask and other browser extension errors
const suppressExtensionErrors = event => {
  const message = (event?.message || event?.reason?.message || '').toString();
  const filename = (event?.filename || event?.reason?.stack || '').toString();

  if (
    message.includes('MetaMask') ||
    message.includes('Failed to connect to MetaMask') ||
    filename.includes('chrome-extension://') ||
    filename.includes('moz-extension://') ||
    filename.includes('inpage.js')
  ) {
    if (event.preventDefault) {
      event.preventDefault();
    }
    return true;
  }
  return false;
};

window.addEventListener('error', event => {
  if (suppressExtensionErrors(event)) {
    return false;
  }
});

window.addEventListener('unhandledrejection', event => {
  if (suppressExtensionErrors(event)) {
    return false;
  }
});

// Also suppress React error overlay for extension errors
const originalError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('MetaMask') ||
    message.includes('chrome-extension://') ||
    message.includes('moz-extension://')
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Register the app
AppRegistry.registerComponent('Buckets', () => App);

// Mount to DOM
AppRegistry.runApplication('Buckets', {
  rootTag: document.getElementById('root'),
});
