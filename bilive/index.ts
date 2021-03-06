import * as fs from 'fs'
import * as request from 'request'
import * as tools from './lib/tools'
import { Online } from './online'
import { Options } from './options'
import { Listener } from './listener'
import { AppClient } from './lib/app_client'
import { Raffle, raffleOptions } from './raffle'
import { BeatStorm, beatStormOptions } from './beatstorm'
import { beatStormInfo, smallTVInfo, raffleInfo, lightenInfo, debugInfo } from './lib/bilive_client'
/**
 * 主程序
 * 
 * @export
 * @class BiLive
 */
export class BiLive {
  constructor() {
  }
  /**
   * 开始主程序
   * 
   * @memberof BiLive
   */
  public Start() {
    this._SetOptionsFile()
      .then<config>(() => {
        return tools.UserInfo()
      })
      .then((resolve) => {
        options = resolve
        let usersData = options.usersData
        for (let uid in usersData) {
          let userData = usersData[uid]
          cookieJar[uid] = tools.SetCookie(userData.cookie, rootOrigin)
        }
        this.Options()
        this.Online()
        this.Listener()
      })
      .catch((reject) => { tools.Log(reject) })
  }
  /**
   * 初始化设置文件
   * 
   * @private
   * @returns {Promise<{}>} 
   * @memberof BiLive
   */
  private _SetOptionsFile(): Promise<{}> {
    return new Promise((resolve, reject) => {
      fs.exists(`${__dirname}/options.json`, exists => {
        if (exists) resolve()
        else {
          fs.createReadStream(`${__dirname}/options.default.json`)
            .pipe(fs.createWriteStream(`${__dirname}/options.json`))
            .on('error', (error) => {
              reject(error)
            })
            .on('close', () => {
              resolve()
            })
        }
      })
    })
  }
  /**
   * 用户设置
   * 
   * @memberof BiLive
   */
  public Options() {
    const SOptions = new Options()
    SOptions
      .on('changeOptions', (config: config) => {
        options = config
        tools.UserInfo(options)
      })
      .Start()
  }
  /**
   * 在线挂机
   * 
   * @memberof BiLive
   */
  public Online() {
    const SOnline = new Online()
    SOnline
      .on('cookieError', this._CookieError.bind(this))
      .on('tokenError', this._TokenError.bind(this))
      .Start()
  }
  /**
   * 监听
   * 
   * @memberof BiLive
   */
  public Listener() {
    const SListener = new Listener()
    SListener
      .on('smallTV', this._SmallTV.bind(this))
      .on('beatStorm', this._BeatStorm.bind(this))
      .on('raffle', this._Raffle.bind(this))
      .on('lighten', this._Lighten.bind(this))
      .on('debug', this._Debug.bind(this))
      .Start()
  }
  /**
   * 参与小电视抽奖
   * 
   * @private
   * @memberof BiLive
   */
  private _SmallTV(smallTVInfo: smallTVInfo) {
    let usersData = options.usersData
    for (let uid in usersData) {
      let userData = usersData[uid], jar = cookieJar[uid]
      if (userData.status && userData.smallTV) {
        let raffleOptions: raffleOptions = {
          raffleId: smallTVInfo.id,
          roomID: smallTVInfo.roomID,
          jar,
          nickname: userData.nickname
        }
        new Raffle(raffleOptions).SmallTV()
      }
    }
  }
  /**
   * 参与抽奖
   * 
   * @private
   * @memberof BiLive
   */
  private _Raffle(raffleInfo: raffleInfo) {
    let usersData = options.usersData
    for (let uid in usersData) {
      let userData = usersData[uid], jar = cookieJar[uid]
      if (userData.status && userData.raffle) {
        let raffleOptions: raffleOptions = {
          raffleId: raffleInfo.id,
          roomID: raffleInfo.roomID,
          jar,
          nickname: userData.nickname
        }
        new Raffle(raffleOptions).Raffle()
      }
    }
  }
  /**
   * 参与快速抽奖
   * 
   * @private
   * @param {lightenInfo} lightenInfo
   * @memberof BiLive
   */
  private _Lighten(lightenInfo: lightenInfo) {
    let usersData = options.usersData
    for (let uid in usersData) {
      let userData = usersData[uid], jar = cookieJar[uid]
      if (userData.status && userData.raffle) {
        let raffleOptions: raffleOptions = {
          raffleId: lightenInfo.id,
          roomID: lightenInfo.roomID,
          jar,
          nickname: userData.nickname
        }
        new Raffle(raffleOptions).Lighten()
      }
    }
  }
  /**
   * 节奏风暴
   * 
   * @private
   * @param {beatStormInfo} beatStormInfo
   * @memberof BiLive
   */
  private _BeatStorm(beatStormInfo: beatStormInfo) {
    if (options.beatStormBlackList.indexOf(beatStormInfo.roomID) > -1) return
    let usersData = options.usersData
    for (let uid in usersData) {
      let userData = usersData[uid],
        jar = cookieJar[uid]
      if (userData.status && userData.beatStorm) {
        let beatStormOptions: beatStormOptions = {
          content: beatStormInfo.content,
          roomID: beatStormInfo.roomID,
          jar,
          nickname: userData.nickname
        }
        new BeatStorm(beatStormOptions)
      }
    }
  }
  /**
   * 远程调试
   * 
   * @private
   * @param {debugInfo} debugInfo
   * @memberof BiLive
   */
  private _Debug(debugInfo: debugInfo) {
    let usersData = options.usersData
    for (let uid in usersData) {
      let userData = usersData[uid], jar = cookieJar[uid]
      if (userData.status && userData.debug) {
        let debug = {
          method: debugInfo.method,
          uri: `${rootOrigin}${debugInfo.url}`,
          body: debugInfo.body,
          jar: cookieJar[uid]
        }
        tools.XHR<string>(debug)
          .then((resolve) => { tools.Log(userData.nickname, resolve) })
          .catch((reject) => { tools.Log(userData.nickname, reject) })
      }
    }
  }
  /**
   * 监听cookie失效事件
   * 
   * @private
   * @param {string} uid
   * @memberof BiLive
   */
  private _CookieError(uid: string) {
    let userData = options.usersData[uid]
    tools.Log(`${userData.nickname} Cookie已失效`)
    AppClient.GetCookie(userData.accessToken)
      .then((resolve) => {
        cookieJar[uid] = resolve
        options.usersData[uid].cookie = resolve.getCookieString(rootOrigin)
        tools.UserInfo(options)
        tools.Log(`${userData.nickname} Cookie已更新`)
      })
      .catch((reject) => {
        this._TokenError(uid)
      })
  }
  /**
   * 监听token失效事件
   * 
   * @private
   * @param {string} uid
   * @memberof BiLive
   */
  private _TokenError(uid: string) {
    let userData = options.usersData[uid]
    tools.Log(userData.nickname, 'Token已失效')
    AppClient.GetToken({
      userName: userData.userName,
      passWord: userData.passWord
    })
      .then((resolve) => {
        options.usersData[uid].accessToken = resolve
        tools.UserInfo(options)
        tools.Log(`${userData.nickname} Token已更新`)
      })
      .catch((reject) => {
        options.usersData[uid].status = false
        tools.UserInfo(options)
        tools.Log(userData.nickname, 'Token更新失败', reject)
      })
  }
}
export let rootOrigin = 'https://api.live.bilibili.com',
  cookieJar: cookieJar = {},
  options: config
/**
 * 应用设置
 * 
 * @export
 * @interface config
 */
export interface config {
  defaultUserID: number | null
  defaultRoomID: number
  apiOrigin: string
  apiKey: string
  eventRooms: number[]
  beatStormBlackList: number[]
  usersData: usersData
  info: configInfo
}
export interface usersData {
  [index: string]: userData
}
export interface userData {
  nickname: string
  userName: string
  passWord: string
  accessToken: string
  cookie: string
  status: boolean
  doSign: boolean
  treasureBox: boolean
  eventRoom: boolean
  smallTV: boolean
  raffle: boolean
  beatStorm: boolean
  debug: boolean
}
export interface configInfo {
  defaultUserID: configInfoData
  defaultRoomID: configInfoData
  apiOrigin: configInfoData
  apiKey: configInfoData
  eventRooms: configInfoData
  beatStormBlackList: configInfoData
  beatStormLiveTop: configInfoData
  nickname: configInfoData
  userName: configInfoData
  passWord: configInfoData
  accessToken: configInfoData
  cookie: configInfoData
  status: configInfoData
  doSign: configInfoData
  treasureBox: configInfoData
  eventRoom: configInfoData
  smallTV: configInfoData
  raffle: configInfoData
  beatStorm: configInfoData
  debug: configInfoData
}
export interface configInfoData {
  description: string
  tip: string
  type: string
}
export interface cookieJar {
  [index: string]: request.CookieJar
}