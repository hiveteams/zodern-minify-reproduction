# Zodern Minify Reproduction

To start app run:
```
meteor run --production
```

## To reproduce

In /client/main.js:

First run the meteor app with line 4 commented out. You will see that the source maps are working correctly
```
line 4: import '/imports/ui/pages/client/mastery/milestone-complete-list.js';
```

Now if you uncomment line 4. Source maps will now map to the wrong position in the file.
