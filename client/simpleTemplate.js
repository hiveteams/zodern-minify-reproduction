import { Template } from 'meteor/templating';
import './simpleTemplate.html';

const Raven = require('raven-js');

Raven.config('https://d657ee5b941649049f5f30e312fbf257@sentry.io/242012', {
  release: __meteor_runtime_config__.autoupdateVersion,
}).install();

Template.simpleTemplate.events({
  'click .throw-error'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    throw new Error('button pressed 22');
  },
});
