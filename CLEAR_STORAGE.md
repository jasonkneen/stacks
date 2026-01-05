# Clear LocalStorage - URGENT

Your localStorage is completely full with corrupted data. To fix:

## In Browser Console (F12):

```javascript
// Clear everything
localStorage.clear();

// Reload
location.reload();
```

This will:
- Clear old corrupted data
- Start fresh with blank canvas
- New saves will use IndexedDB for images (no quota issues)

**Do this now before anything else will work!**
