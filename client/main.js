import '/imports/startup/client';

import { Meteor } from 'meteor/meteor';
import '/imports/ui/pages/client/mastery/milestone-complete-list.js';
import './simpleTemplate';

Meteor.methods({
  throwError: () => {
    throw new Error('test with all code commented out');
  },
});
