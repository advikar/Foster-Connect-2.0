# Save this with a passcode (Y6)

Built 2026-09-15. Lets a young person open the same anonymous session on another device
(their next phone, or a caseworker's computer with them present) with a few words they choose.
Not an account: no email, no name, no reminders, no prompt on first visit. Offered only from
My plan (below the plan, and below the intake on a device with no plan yet) and Privacy.

## What is stored

Table `session_passcodes`, one row per session:

| column | what it is |
|---|---|
| `lookup` | HMAC-SHA256(server secret, normalised passcode). Finds the row without storing the passcode. |
| `session_id` | the anonymous session it opens (unique: one passcode per session) |
| `salt`, `iv`, `cipher`, `tag` | the session id encrypted with AES-256-GCM under scrypt(passcode, salt) |

The passcode itself is never stored. Normalisation: trim, lower-case, collapse spaces, so
"Blue Bike 2019" and "blue  bike 2019" match. Server secret: `PASSCODE_SECRET`, falling back to
`CHAT_SIGNING_SECRET` (which production already requires). Without it a per-process key is used
and passcodes stop working on restart.

## Threat model

- **Online guessing.** `POST /api/session/restore` is limited to 8 attempts per 15 minutes per
  address, on top of the general API limit. Passcodes must be 8+ characters and a few obvious
  ones are refused. Wrong and unknown passcodes get the same reply.
- **Database copy without the server secret.** Rows cannot be searched by passcode; an attacker
  would have to run scrypt (N=16384) against every row per guess, with no index to help.
- **Database copy with the secret.** Each row still costs a scrypt run per guess. The prize is a
  session id, which yields a plan and saved listings but never a name, email or location beyond
  county.
- **Collisions.** Two people choosing the same passcode: the second is told to add a word. This
  reveals that some passcode is in use; accepted because the alternative (silently overwriting or
  merging) is worse and the rate limit makes enumeration impractical.
- **Shared devices.** Opening a plan on a computer stores the session id in that browser exactly
  as a fresh visit would. The Privacy page's "library or shared computer" advice applies: delete
  before leaving. "Forget the passcode" removes the row; "Delete my data" removes it too.

## Who can reset it

Nobody. There is no recovery path by design: a reset flow needs an identity, and the whole point
is not having one. A forgotten passcode means the plan cannot be opened on a *new* device; the
device that already has it is unaffected, and a new passcode can be set from there.

## What a caseworker sees

Exactly what the young person sees, on the young person's terms: the youth types the passcode on
the caseworker's computer. The partner workspace has no access to sessions, passcodes or plans;
nothing about this feature appears on the partner side.
