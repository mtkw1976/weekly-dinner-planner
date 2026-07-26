/**
 * Google Drive API Sync Module for Weekly Dinner & Grocery Planner
 * Allows saving & syncing weekly menus and grocery archives across devices (iPhone <-> Android)
 */

const DRIVE_FILE_NAME = 'WeeklyDinnerPlanner_Data.json';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

export class GoogleDriveSync {
  constructor() {
    this.clientId = localStorage.getItem('gdrive_client_id') || '';
    this.accessToken = localStorage.getItem('gdrive_access_token') || '';
    const savedFileId = localStorage.getItem('gdrive_file_id');
    this.fileId = this.isValidFileId(savedFileId) ? savedFileId : '';
    this.tokenClient = null;
    this.isAuthorized = Boolean(this.accessToken);
  }

  isValidFileId(id) {
    return Boolean(id && id !== 'undefined' && id !== 'null' && typeof id === 'string' && id.trim() !== '');
  }

  setClientId(id) {
    this.clientId = id.trim();
    localStorage.setItem('gdrive_client_id', this.clientId);
  }

  getClientId() {
    return this.clientId;
  }

  // Initialize Google OAuth Token Client using Google Identity Services (GIS)
  initGoogleAuth(onSuccess, onError) {
    if (!this.clientId) {
      if (onError) onError('Google Cloud Client IDが設定されていません');
      return;
    }

    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_SCOPES,
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.error('Google Auth Error:', tokenResponse);
              if (onError) onError(tokenResponse.error);
              return;
            }
            this.accessToken = tokenResponse.access_token;
            this.isAuthorized = true;
            localStorage.setItem('gdrive_access_token', this.accessToken);
            if (onSuccess) onSuccess(this.accessToken);
          },
        });
        this.tokenClient.requestAccessToken();
      } catch (err) {
        console.error('Failed to init token client:', err);
        if (onError) onError(err.message);
      }
    } else {
      if (onError) onError('Google Identity Services SDKが読み込まれていません');
    }
  }

  /**
   * Search for existing file in Google Drive or create a new one
   */
  async findOrCreateDriveFile() {
    if (!this.accessToken) throw new Error('認証トークンがありません。Googleにログインしてください。');

    // 1. Search for file by name
    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );

    if (response.status === 401) {
      this.accessToken = '';
      localStorage.removeItem('gdrive_access_token');
      throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
    }

    if (response.ok) {
      const result = await response.json();
      if (result.files && result.files.length > 0 && this.isValidFileId(result.files[0].id)) {
        this.fileId = result.files[0].id;
        localStorage.setItem('gdrive_file_id', this.fileId);
        return this.fileId;
      }
    }

    // 2. File not found on Drive, create new JSON file metadata
    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: DRIVE_FILE_NAME,
          mimeType: 'application/json',
        })
      }
    );

    if (createRes.status === 401) {
      this.accessToken = '';
      localStorage.removeItem('gdrive_access_token');
      throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
    }

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Google Driveへのファイル作成に失敗しました: ${errText}`);
    }

    const createdFile = await createRes.json();
    if (!createdFile || !this.isValidFileId(createdFile.id)) {
      throw new Error('Google Driveの新規ファイルID取得に失敗しました。');
    }

    this.fileId = createdFile.id;
    localStorage.setItem('gdrive_file_id', this.fileId);
    return this.fileId;
  }

  /**
   * Save (Upload) entire app state to Google Drive
   */
  async saveToDrive(data) {
    if (!this.accessToken) {
      throw new Error('Google Driveに接続されていません。');
    }

    if (!this.isValidFileId(this.fileId)) {
      await this.findOrCreateDriveFile();
    }

    const payload = JSON.stringify(data, null, 2);
    let updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: payload
      }
    );

    if (updateRes.status === 401) {
      this.accessToken = '';
      localStorage.removeItem('gdrive_access_token');
      throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
    }

    // Handle 404 (File not found / undefined fileId on Drive) -> recreate file & retry save once
    if (updateRes.status === 404) {
      console.warn('Google Drive上のファイルが見つかりません(404)。新規ファイルを作成して再保存します...');
      localStorage.removeItem('gdrive_file_id');
      this.fileId = '';
      await this.findOrCreateDriveFile();

      updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: payload
        }
      );

      if (updateRes.status === 401) {
        this.accessToken = '';
        localStorage.removeItem('gdrive_access_token');
        throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
      }
    }

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Google Driveへの保存に失敗しました: ${errText}`);
    }

    return await updateRes.json();
  }

  /**
   * Load (Download) data from Google Drive
   */
  async loadFromDrive() {
    if (!this.accessToken) {
      throw new Error('Google Driveに接続されていません。');
    }

    if (!this.isValidFileId(this.fileId)) {
      await this.findOrCreateDriveFile();
    }

    let downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );

    if (downloadRes.status === 401) {
      this.accessToken = '';
      localStorage.removeItem('gdrive_access_token');
      throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
    }

    if (downloadRes.status === 404) {
      console.warn('Google Drive上のファイルが見つかりません(404)。新規ファイルを作成して再試行します...');
      localStorage.removeItem('gdrive_file_id');
      this.fileId = '';
      await this.findOrCreateDriveFile();

      downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );

      if (downloadRes.status === 401) {
        this.accessToken = '';
        localStorage.removeItem('gdrive_access_token');
        throw new Error('Google Driveの認証期限が切れました。再度ログインしてください。');
      }
    }

    if (!downloadRes.ok) {
      throw new Error('Google Driveからのデータ読み込みに失敗しました。');
    }

    const data = await downloadRes.json();
    return data;
  }
}

export const driveSync = new GoogleDriveSync();
