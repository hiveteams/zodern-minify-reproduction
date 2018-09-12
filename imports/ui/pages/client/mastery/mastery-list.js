import './mastery-list.html';
import './milestone-complete-list.js';

import { $ } from 'meteor/jquery';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import OnboardingListManager from '/imports/ui/lib/onboarding-helpers';

Template.onboardingList.onRendered(function onRendered() {
  const instance = this;

  instance.autorun(() => {
    const user = Meteor.users.findOne(Meteor.userId(), {
      fields: { onboardingMilestones: 1, 'profile.primaryWorkspace': 1 },
    });

    // Ensure initialization
    if (user && !user.onboardingMilestones.find(item => item === 'firstStart')) {
      // Show welcome dropdown
      $('#onboarding-list-dropdown').addClass('open');
    }
  });
});

Template.onboardingList.events({
  'click .js-ob-item'(event) {
    event.stopPropagation();
  },
  'click .js-show-hint'(event) {
    const objItems = document.getElementsByClassName('js-show-hint');
    const showHintClass = 'show-hint';
    const targetEl = event.currentTarget;
    const hintShown = targetEl.classList.contains(showHintClass);

    for (let i = 0; i < objItems.length; i++) {
      objItems[i].classList.remove(showHintClass);
    }

    if (!hintShown) {
      targetEl.classList.add(showHintClass);
    }
  },
  'click .js-get-started'() {
    // Set onboardingMilestone
    Meteor.call('completeOnboardingMilestone', 'firstStart');
  },
});

Template.onboardingList.helpers({
  allMilestonesComplete() {
    return OnboardingListManager.numberComplete() === OnboardingListManager.items.length;
  },
  obItems() {
    // Filter items based on Workspace messaging setting
    return OnboardingListManager.items.filter(
      item => !item.messagingRequired || this.isHiveMessaging
    );
  },

  obItemCompleteClass(item) {
    if (!item.id) return '';
    const user = Meteor.users.findOne(Meteor.userId(), { fields: { onboardingMilestones: 1 } });
    const complete =
      user && user.onboardingMilestones && user.onboardingMilestones.indexOf(item.id) > -1;

    return complete ? 'ob-item-complete' : '';
  },

  firstVisit() {
    return !OnboardingListManager.isMilestoneComplete('firstStart');
  },
});
