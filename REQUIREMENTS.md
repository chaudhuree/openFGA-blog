
OpenFGA API: [exposed on 8080](http://localhost:8080)
OpenFGA Playground: [exposed on 3001](http://localhost:3001)
Adminer (DB UI): [exposed on 8082](http://localhost:8082)

```
POSTGRES_USER: bloguser
POSTGRES_PASSWORD: blogpass
POSTGRES_DB: blogdb
```

## Typical flow
1. Login to create a user
- POST /auth/login with { "email": "you@example.com" } → copy user.id and token
2. Make yourself admin (first time)
- In Playground, write tuple: user:<YOUR_ID> admin org:blog
3. Create posts (requires editor/moderator/admin)
- POST /posts (defaults to draft, you are owner)
4. Edit/delete/publish
- Edit: owner or per-post granted editor
- Delete: owner or org admin/moderator
- Publish: org admin/moderator
5. Transfer ownership
- POST /posts/{id}/transfer-owner with { "newOwnerUserId" }
- Allowed for current owner or admin; new owner must be editor
6. Per-post edit grant (admin → moderator)
- POST /posts/{id}/grant-edit with { "moderatorUserId" }