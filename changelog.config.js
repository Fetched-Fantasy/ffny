// changelog.config.js

module.exports = {
  types: [
    {
      type: 'feat',
      section: 'Features',
      hidden: false // Set to true to hide this type from the changelog
    },
    {
      type: 'fix',
      section: 'Bug Fixes',
      hidden: false
    },
    {
      type: 'chore',
      section: 'Chores',
      hidden: false
    },
    {
      type: 'docs',
      section: 'Documentation',
      hidden: false
    },
    {
      type: 'style',
      section: 'Styles',
      hidden: false
    },
    {
      type: 'refactor',
      section: 'Refactorings',
      hidden: false
    },
    {
      type: 'perf',
      section: 'Performance Improvements',
      hidden: false
    },
    {
      type: 'test',
      section: 'Tests',
      hidden: false
    },
    {
      type: 'build',
      section: 'Build System',
      hidden: false
    },
    {
      type: 'ci',
      section: 'Continuous Integration',
      hidden: false
    }
  ]
};