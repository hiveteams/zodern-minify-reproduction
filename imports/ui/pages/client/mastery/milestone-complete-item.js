import './milestone-complete-item.html';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import OnboardingListManager from '/imports/ui/lib/onboarding-helpers';

const _removeTemplate = {
  getFunction(instance) {
    return function () {
      OnboardingListManager.recentMilestones.remove(instance.data.index);
    };
  },

  getTimeoutId(instance) {
    const removeTemplateFn = _removeTemplate.getFunction(instance);
    const removeTemplateDuration = 5000;

    return Meteor.setTimeout(removeTemplateFn, removeTemplateDuration);
  },
};

Template.milestoneCompleteItem.onRendered(function () {
  const instance = this;
  instance.removeTemplateTimeoutId = _removeTemplate.getTimeoutId(instance);
});
