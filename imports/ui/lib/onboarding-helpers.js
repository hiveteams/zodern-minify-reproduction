/* eslint-disable max-len, global-require */
import { ReactiveVar } from 'meteor/reactive-var';
import { Blaze } from 'meteor/blaze';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { _ } from 'meteor/underscore';

const OnboardingListManager = {};
export default OnboardingListManager;

// if (Meteor.isClient) {
// require('/imports/ui/pages/client/mastery/milestone-complete-list.js');
// }

OnboardingListManager.recentMilestones = {
  view: null,
  list: new ReactiveVar([]),
  add(milestoneItem) {
    const recentMilestonesArr = OnboardingListManager.recentMilestones.list.get();
    const updatedMilestonesList = recentMilestonesArr.concat(milestoneItem);
    OnboardingListManager.recentMilestones.list.set(updatedMilestonesList);
  },
  remove(index) {
    const recentMilestonesArr = OnboardingListManager.recentMilestones.list.get();
    recentMilestonesArr.splice(index, 1);
    OnboardingListManager.recentMilestones.list.set(recentMilestonesArr);
  },
  removeAll() {
    OnboardingListManager.recentMilestones.list.set([]);
  },
};

OnboardingListManager.completeItem = function complete(itemId, showModal = true) {
  // Get milestone item index
  const itemIndex = _.pluck(this.items, 'id').indexOf(itemId || '');
  // Default showModal to true
  if (Meteor.isServer) showModal = false;
  if (itemIndex > -1) {
    let user = Meteor.users.findOne(Meteor.userId(), {
      fields: { onboardingMilestones: 1 },
    });
    const milestoneItem = this.items[itemIndex];
    // Update user if not already on milestones
    if (
      user &&
      user.onboardingMilestones &&
      user.onboardingMilestones.indexOf(milestoneItem.id) === -1
    ) {
      Meteor.call('completeOnboardingMilestone', milestoneItem.id, () => {
        // Get updated user
        user = Meteor.users.findOne(Meteor.userId(), {
          fields: { onboardingMilestones: 1 },
        });

        // Check again to avoid double trigger
        if (
          showModal &&
          user &&
          user.onboardingMilestones &&
          user.onboardingMilestones.indexOf(milestoneItem.id) > -1
        ) {
          // Add milestone to recent milestones list if it hasn't been completed
          OnboardingListManager.recentMilestones.add(milestoneItem);

          // Render milestoneCompleteList template if it hasn't already rendered
          if (!OnboardingListManager.recentMilestones.view) {
            const template = Template.milestoneCompleteList;
            const dataContext = {
              milestones: OnboardingListManager.recentMilestones.list,
            };
            const parentNode = document.getElementById('onboarding-list-dropdown');
            const nextNode = document.getElementById('onboardingList');
            if (parentNode && nextNode) {
              const view = Blaze.renderWithData(template, dataContext, parentNode, nextNode);
              OnboardingListManager.recentMilestones.view = view;
            }
          }
        }
      });
    }
  }
};

OnboardingListManager.isMilestoneComplete = milestone => {
  const user = Meteor.users.findOne(Meteor.userId(), {
    fields: { onboardingMilestones: 1 },
  });
  const userMilestones = (user && user.onboardingMilestones) || [];

  return userMilestones.find(item => item === milestone);
};

OnboardingListManager.numberComplete = function numComplete() {
  const user = Meteor.users.findOne(Meteor.userId(), {
    fields: { onboardingMilestones: 1 },
  });
  const userMilestones = (user && user.onboardingMilestones) || [];
  let count = 0;
  // Make sure to only count items that are valid/exist in the list
  OnboardingListManager.items.forEach(item => {
    if (userMilestones.indexOf(item.id) > -1) {
      count++;
    }
  });
  return count;
};

OnboardingListManager.items = [
  {
    id: 'signup',
    text: 'Sign-up to Hive',
    hint: '',
    completedText: 'You successfully signed up for Hive!',
  },
  {
    id: 'actionStatusInProgress',
    text: 'Drag an action to <i>In progress</i> status',
    hint:
      'Click on the pinned project in the action panel, then drag one of the project’s action cards to “In progress”.',
    completedText: 'Success! You changed the status of an action.',
  },
  {
    id: 'viewProjectLayouts',
    text: 'View your project in different layouts',
    hint: 'Go to your project, and hit "Change layout" to see your project in different styles.',
    completedText: 'Success! You can change project layouts at any time.',
  },
  {
    id: 'addActionLabel',
    text: 'Create a new action, and add a label',
    hint:
      'Click the “+ New action” button in the top toolbar. Find the label icon <icon> in the action card to create a label.',
    completedText: 'Success! You created an action and added a new label.',
  },
  {
    id: 'importActions',
    text: 'Import your tasks from other apps',
    hint: 'Click your avatar in the top toolbar and select “Import tasks” from the menu.',
    completedText: 'Success! You imported tasks from other apps.',
  },
  {
    id: 'invite',
    text: 'Invite your teammates',
    hint: 'Find the "Add a teammate" button on the top toolbar',
    completedText:
      "You've successfully invited a teammate! Inviting more users early is the single most important thing you can to do to succeed.",
  },
  {
    id: 'connectFileStore',
    text: 'Connect your file storage',
    hint:
      'Click the file icon <i class="fa fa-file-text-o hint-icon"></i> at the top tool bar. Select a file store to connect.',
    completedText:
      "You've successfully connected your file store! Now you can access files from it within Hive",
  },
  {
    id: 'shareFile',
    text: 'Share a file',
    hint:
      'Click the "+" button on the messages panel or drag and drop a file onto the messages panel',
    completedText: "You've successfully shared a file with the group!",
    messagingRequired: true,
  },
  {
    id: 'shareAction',
    text: 'Share an action',
    hint: 'Click and drag an action onto the messaging panel or a group',
    completedText: "You've successfully shared an action with the group!",
    messagingRequired: true,
  },
  {
    id: 'messageToAction',
    text: 'Turn a message into an action',
    hint:
      'Hover a message to reveal the "+" symbol, then grab it to drag the message to the Actions panel (center panel)',
    completedText:
      "Never miss a co-worker's request again! Turning messages into actions is an incredibly simple way to avoid forgetting things.",
    messagingRequired: true,
  },
  {
    id: 'hiveApps',
    text: 'Check out Hive Apps for more advanced features',
    hint: 'Click your avatar in the top toolbar and select “Hive apps” from the menu.',
    completedText: 'Success! You checked out Hive apps.',
  },
];
