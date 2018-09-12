import './milestone-complete-list.html';
// import './milestone-complete-item.js';
import { Template } from 'meteor/templating';

Template.milestoneCompleteList.helpers({
  milestones() {
    return this.milestones.get();
  },
});
