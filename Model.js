/**
 */
export default class Model {
  /**
   */
  constructor() {
    this.firebase = window.firebase;
    if (this.firebase.apps.length === 0) {
      this.initialize();
    } else {
      this.firestore = this.firebase.firestore();
    }
    this.currentUser = this.getUserData(this.firebase.auth().currentUser);

    this.groupsTable = 'groups';
    this.tableFiller = 'items';
    this.sitesTable = 'sites';
    this.warehouseTable = 'warehouses';
    this.settingsTable = 'settings';
    this.attributesTable = 'attributes';
  }

  /**
   * @return {Object} config;
   */
  config() {
    const environment = window.settings.environment;
    return {
      apiKey: window.firebaseConnection[environment].apiKey,
      authDomain: window.firebaseConnection[environment].authDomain,
      databaseURL: window.firebaseConnection[environment].databaseURL,
      projectId: window.firebaseConnection[environment].projectId,
      storageBucket: window.firebaseConnection[environment].storageBucket,
      messagingSenderId:
        window.firebaseConnection[environment].messagingSenderId,
    };
  }

  /**
   * @param {Object} user User
   * @return {Object} current user
   */
  getUserData(user) {
    if (!user) return;
    let currentUser = {
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
      phoneNumber: user.phoneNumber,
      photoURL: user.photoURL,
      providerData: user.providerData,
      uid: user.uid,
    };

    return currentUser;
  }

  /**
   */
  initialize() {
    const config = this.config();
    this.firebase.initializeApp(config);
    const firestore = this.firebase.firestore();
    this.firestore = firestore;
  }

  /**
   * @param {Object} reference firebase reference
   * @return {String} pushKey
   */
  getPushKey(reference) {
    return reference.id;
  }

  /**
   * @param {String} collection Collection name
   * @param {String} documentKey Document key
   * @return {Promise} firestore collection
   */
  getDocument(collection, documentKey = null) {
    if (!documentKey) {
      return this.firestore.collection(collection);
    }
    return this.firestore.collection(collection).doc(documentKey);
  }

  /**
   * @param {Number} latitude Latitude
   * @param {Number} longitude Longitude
   * @return {Object} GeoPoint data
   */
  processGeoPointData(latitude, longitude) {
    const valLatitude = latitude || 0;
    const valLongitude = longitude || 0;
    return new this.firebase.firestore.GeoPoint(valLatitude, valLongitude);
  }

  /**
   *
   * @param {Object} createdAt Previous createdAt
   * @return {Object} Additional timestamp values
   */
  modelItems(createdAt) {
    if (createdAt) {
      const created = {
        createdAt: createdAt || Date.now(),
      };

      const createdBy = {
        createdBy: this.currentUser,
      };

      const updated = {
        updatedAt: Date.now(),
      };

      return Object.assign(created, createdBy, updated);
    }

    if (!createdAt) {
      const updated = {
        updatedAt: Date.now(),
      };

      return Object.assign(updated);
    }
  }

  /**
   * @return {Object} user details
   */
  userData() {
    return {
      email: this.currentUser.email,
      displayName: !this.currentUser.displayName
        ? ''
        : this.currentUser.displayName,
      userId: this.currentUser.uid,
    };
  }

  /**
   * When formatFunc is null,
   * add extra information to the current data
   *
   * @param {Function} update Update
   * @return {Object} Saved value
   */
  setSavedValues(update = false) {
    if (!update) {
      return Object.assign(
        this.modelItems(Date.now()),
        Object.assign({}, this.format())
      );
    }

    if (update) {
      return Object.assign(this.modelItems(), Object.assign(this.format()));
    }
  }

  /**
   * @param {String} email Email address
   * @return {Object} Object
   */
  sendEmail(email) {
    return this.firebase
      .auth()
      .sendPasswordResetEmail(email)
      .catch(err => {
        this.triggerToast(err.message);
        throw err.message;
      });
  }

  /**
   * @description Need to confirm if firebase is present so we don't try things
   * @return {Boolean} Firebase
   */
  checkForFirebase() {
    if (!this.firebase) {
      this.noFireBase();
      return false;
    }
    return true;
  }

  /**
   * @description a generic function which can find the object and copy all
   *  fields except three fields(createdAt, createdBy, updates)
   *  from the given list according to the firebaseKey.
   *  And it can be reuse by all dropdown menus.
   *
   * @param {String} firebaseKey firebase push key
   * @param {Array} list existed list
   * @return {Object} existed object
   */
  populateReplication(firebaseKey, list) {
    if (!firebaseKey) return '';

    const itemData = list.find(item => {
      return firebaseKey === item.id;
    });

    let data = {};
    data.id = firebaseKey;

    return Object.assign(data, itemData.data);
  }

  /**
   * @param {Object} formData Form data
   * @return {Object} Form data
   */
  cleanItem(formData) {
    delete formData.$id;
    delete formData.createdAt;
    delete formData.updatedAt;

    return formData;
  }

  /**
   * Checks the list of items in a dropdown so the correct
   * selected value is returned
   * @param {Object} value Firebase Object
   * @param {Array} options Dropdown options
   * @return {String} Firebase Key
   */
  selectDropdownValue(value, options) {
    if (!options) return null;
    if (!value) return null;
    let key = null;
    key = options.find(option => {
      return option.id === value.id;
    });
    return !key ? null : key.id;
  }

  /**
   * @param {Object} snapshot Firebase snapshot
   * @return {Array} list
   */
  getList(snapshot) {
    let list = [];
    snapshot.forEach(doc => {
      list.push({
        id: doc.id,
        data: doc.data(),
      });
    });
    return list;
  }
  /**
   * @param {Array} snapshotList the pre-formatted list
   * @return {Array} formatted snapshots list
   */
  formatSnapshot(snapshotList) {
    let formattedSnapshots = [];
    snapshotList.forEach(snapshot => {
      formattedSnapshots.push(this.format(snapshot));
    });
    return formattedSnapshots;
  }

  /**
   * @param {Object} batch the batch
   * @param {String} table the tablename
   * @return {Promise} the promise of a batched create
   */
  _batchCreate(batch, table) {
    const reference = this.firestore.collection(table).doc();
    const pushKey = this.getPushKey(reference);
    const batchRef = this.firestore.collection(table).doc(pushKey);
    return batch.set(batchRef, this.setSavedValues());
  }

  /**
   * @return {Object} the batch function
   */
  initBatch() {
    return this.firestore.batch();
  }

  /**
   * @param {Object} batch the batch
   * @return {Object} the promise
   */
  completeBatch(batch) {
    return batch.commit();
  }
}
