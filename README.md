# RingQ × Qontak CRM integration: handover package

This folder holds everything needed to put the Qontak integration live on a RingQ server. Each team gets its own folder and its own guide.

## Documents

- **[RingQ × Qontak CRM — User Guide](https://claude.ai/code/artifact/32c5990f-b5b8-4e47-88e3-eda742e16dd1)** (for the client): get the Client ID and Secret from Mekari, connect Qontak in RingQ, every option with screenshots, daily use, troubleshooting.
- **[RingQ × Qontak CRM Integration — Complete Guide](https://claude.ai/code/artifact/a221c4c0-b921-49c3-a44b-1b112b8d0943)**: Qontak account and API credentials, RingQ configuration and every setting, daily use, where each frontend and backend file goes on the server, `services.php` ACL lines, database, key, cron, verify checklist, API reference, troubleshooting. It replaces the three earlier guides.

## Folders

```
qontak-handover/
├── screenshots/                   RingQ Qontak settings window (4 PNGs, Client ID hidden)
├── frontend/                      → Frontend team
│   ├── build/ringq-cloudapp-qontak.zip   ready-to-deploy build (unzip over the live cloudapp folder)
│   └── source/src/…                      new + modified source files, at their repo paths
│       ├── integrations/qontak/          NEW module (8 files + 4 tests)
│       ├── components/IntegrationsModal.tsx   modified (Qontak card + dialog)
│       ├── components/appSearchIndex.ts       modified (search keyword)
│       └── App.jsx                            modified (mounts QontakCallBridge)
└── backend/                       → Backend / server team
    ├── qontak-backend.zip               everything below in one zip
    ├── app/controllers/QontakController.php
    ├── app/library/Qontak/*.php         5 files
    ├── app/tasks/QontakTask.php
    ├── migrations/                      create tables (+ rollback)
    └── config-snippets/                 services.php ACL lines, crontab lines
```

## Go-live order

1. **Backend first** (Backend Deployment Guide, steps 1–7, then Verify).
2. **Frontend** (Frontend Deployment Guide: deploy the zip, then Verify).
3. **Client admin** connects Qontak (Client User Guide, Steps 1–2) and allows pop-ups.
