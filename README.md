# Polished

A nail booking app for Cornell. Customers find nail techs and book appointments. Techs set their hours, prices and policies, then accept requests. Built with React Native (Expo) and Firebase.

See [CODEBASE.md](CODEBASE.md) for how the code is organized.

## Run it

1. Install Node, Xcode and CocoaPods.
2. Put `.env.local` and `GoogleService-Info.plist` in the repo root. They're git-ignored, so ask for them.
3. Run:
   ```bash
   npm install
   npm run ios
   ```

## Firebase setup

In the [Firebase console](https://console.firebase.google.com):

1. **Authentication → Sign-in method:** enable **Google**.
2. **Firestore Database:** create it. The app creates its own collections.
3. **Storage:** enable it for portfolio photos.
4. **Firestore → Rules:** publish rules like these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    // Anyone signed in can read profiles (names, tech list); only you can edit yours.
    match /users/{userId} {
      allow read: if signedIn();
      allow write: if signedIn() && request.auth.uid == userId;
    }

    // Only the client and the tech can see or change an appointment.
    match /appointments/{id} {
      allow read, update, delete: if signedIn()
        && request.auth.uid in [resource.data.clientId, resource.data.techId];
      allow create: if signedIn() && request.resource.data.clientId == request.auth.uid;
    }

    // Reviews are public; only the client who wrote one can create it.
    match /reviews/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.clientId == request.auth.uid;
    }

    // Tech applications are stored at applications/{uid}. You can only see and edit your own.
    match /applications/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    // Chat threads and messages: participants only.
    match /threads/{threadId} {
      allow read, update: if signedIn() && request.auth.uid in resource.data.participantIds;
      allow create: if signedIn() && request.auth.uid in request.resource.data.participantIds;

      match /messages/{messageId} {
        function isParticipant() {
          return request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.participantIds;
        }
        allow read: if signedIn() && isParticipant();
        allow create: if signedIn() && isParticipant() && request.resource.data.senderId == request.auth.uid;
      }
    }
  }
}
```

If Firestore logs an error with an index link (for example, for the weekly booking limit), open the link to create the index.
