let store = require('store/dist/store.modern') as StoreJSStatic;
import * as m from 'mithril';
import * as Toaster from 'components/toaster';

export interface User {
  email: string;
  uuid: string;
}

interface Preferences {
  hideMenu: boolean;
}

interface Storer {
  get(key: string): any;
  set(key: string, val: any): void;
}

class DummyStore {
  data: any;

  constructor() {
    this.data = {};
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, val: any) {
    this.data[key] = val;
  }
}

let cachedUser: User = null;
let dummyStore = new DummyStore();

export let getUser = (force = false): Promise<User> => {
  if (cachedUser && !force) {
    return new Promise<User>((resolve) => {
      resolve(cachedUser);
    });
  }
  return m
    .request({
      method: 'GET',
      url: '/api/v1/user'
    })
    .then((res: User) => {
      if (!res.uuid) {
        throw new Error('not logged in');
      }
      cachedUser = res;
      return res;
    })
    .catch(() => {
      cachedUser = null;
      throw new Error('not logged in');
    });
};


export interface BaseComponent<A = {}> extends m.ClassComponent<A> {}
export abstract class BaseComponent<A> {
  protected readonly props: A;
  constructor(v: m.CVnode<A>) {
    this.props = v.attrs;
  }
}

export interface IBaseComponent<A = {}> {
  new(v: m.CVnode<A>): BaseComponent<A>;
}

// AuthController is a super class for controllers which may require auth
export interface AuthController<A = {}> extends BaseComponent<A> {}
export abstract class AuthController<A> {
  user: User;
  _userPromise: Promise<User>;
  store: Storer;

  constructor(_?: m.CVnode<A>) {
    this.store = store.disabled ? dummyStore : store;
    this.user = cachedUser;
    this._userPromise = getUser().then((user) => {
      this.user = user;
      return user;
    });
  }

  logout() {
    m
      .request({
        method: 'GET',
        url: '/api/v1/logout',
        background: false
      })
      .then(() => {
        Toaster.add('logged out');
        setTimeout(() => {
          location.reload();
        }, 2000);
      });
  }

  private get storeKey(): string {
    if (!this.user) {
      return null;
    }
    return `user-${this.user.uuid}`;
  }

  private getPrefs(): Preferences {
    if (!this.user) {
      return null;
    }
    let prefs: Preferences = this.store.get(this.storeKey);
    if (!prefs) {
      prefs = {
        hideMenu: false
      };
      this.store.set(this.storeKey, prefs);
    }
    return prefs;
  }

  pref<K extends keyof Preferences>(key: K): Preferences[K] {
    if (!this.user) {
      return; // error
    }
    let prefs: Preferences = this.getPrefs();
    if (!prefs) {
      return; // error
    }
    return prefs[key];
  }

  setPref<K extends keyof Preferences>(key: K, val: Preferences[K]) {
    if (!this.user) {
      return; // error
    }
    let prefs: Preferences = this.getPrefs();
    prefs[key] = val;
    this.store.set(this.storeKey, prefs);
  }
}

export abstract class MustAuthController<A = {}> extends AuthController<A> {
  ready: boolean;
  constructor() {
    super();
    this.ready = false;
    this._userPromise.then((user) => {
      if (!user || !user.uuid) {
        window.location.assign(`/admin/login?next=${window.location.pathname}`);
      } else {
        this.ready = true;
      }
    });
  }
}
