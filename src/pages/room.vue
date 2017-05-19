<template>
  <section class="page-room">
    <div class="view-self">
      <chat-view :stream="selfStream"></chat-view>
      <div class="info">
        <span>CHAT ROOM: {{ room }}</span>
        <span>NICKNAME: {{ nickname }}</span>
        <span>TARGET NICKNAME: {{ targetNickname }}</span>
      </div>
    </div>
    <div class="view-other">
      <chat-view :stream="userStream"></chat-view>
    </div>
  </section>
</template>

<script>
import GetApp from '@/common/getApp.js'
import Dog from '@/wilddog/index.js'
import ChatView from '@/components/chat-view.vue'

const ICE_SERVERS = {
  'iceServers': [
    {
      'url': 'stun:cn1-stun.wilddog.com:3478'
    }
  ]
}

function errHandler (err) {
  console.log(err)
}

export default {
  mixins: [GetApp],

  data () {
    this.dog = Dog
    // 链接对象
    this.peer = null
    return {
      selfStream: null,
      userStream: null,
      targetNickname: ''
    }
  },

  methods: {
    // 创建视频流数据
    createLocalStream () {
      return navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      }).then(stream => {
        this.selfStream = stream
      }, err => {
        console.log('GetUserMedia error: ', err)
      })
    },


    createPeer (stream, remoteUserMailboxRef, localUserId) {
      if (stream == null) {
        console.log('set peer: cannot get local stream')
        return null
      }

      const peer = new RTCPeerConnection(ICE_SERVERS)
      this.peer = peer

      // 添加本地stream到要传输的的stream列表中
      peer.addStream(stream, err => {
        if (err) {
          console.log('setPeer: add stream error code: ', err)
        }
      })
      // 设置当收到对端stream时的回调
      peer.onaddstream = evt => {
        this.userStream = evt.stream
      }

      // 当收到底层ice candidate 消息，说明已经准备好了新的 candidate，发送给对端
      peer.onicecandidate = function (evt) {
        console.log('onicecandidate')
        if (evt.candidate == null) { return }
        const candidate = {}
        candidate['from'] = localUserId
        candidate['type'] = 'candidate'
        candidate['value'] = JSON.stringify(evt.candidate)
        remoteUserMailboxRef.push(candidate)
      }
      return peer
    },

    createOffer (remoteUserMailboxRef, localUserId) {
      if (!this.peer) {
        console.error('peer is null')
        return
      }
      // 根据本地信息（媒体/ip等）创建offer，并发送到对端
      this.peer.createOffer(description => {
        // 创建出来的offer先在本地保存一份
        this.peer.setLocalDescription(description, evt => {
          // 发送到对端信箱
          remoteUserMailboxRef.push({
            from: localUserId,
            type: 'offer',
            value: JSON.stringify(description)
          })
        }, errHandler)
      }, errHandler)
    },

    // 获取在线用户列表，广播自己的 offer
    broadcastOfferToRemote () {
      this.dog.once('value', snap => {
        snap.forEach(snapshot => {
          const remoteNickname = snapshot.key()
          if (remoteNickname === this.nickname) return
          const remoteRef = this.dog.child(remoteNickname).child('mailbox')
          this.createPeer(this.selfStream, remoteRef, this.nickname)
          this.createOffer(remoteRef, this.nickname)
        })
      })
    },

    // 监听自己信箱下是否有新信到来
    listenerSelfMailbox () {
      const { dog, nickname, selfStream } = this
      dog.child(nickname).child('mailbox').on('child_added', snapshot => {
        if (snapshot.val() == null) {
          return
        }

        // 获取寄件人的id
        const remoteNickname = snapshot.child('from').val()
        this.targetNickname = remoteNickname

        // 获取信的类型
        const type = snapshot.child('type').val()

        if (type == 'offer') {
          // 收到对端的offer请求
          console.log('received offer')
          let offer = JSON.parse(snapshot.child('value').val())
          let remoteUserMailboxRef = dog.child(remoteNickname).child('mailbox')
          // 收到对端的一个连接请求，建立p2p连接，并将回复返回给对端
          this.handleRemoteOffer(remoteUserMailboxRef, nickname, offer, selfStream)
          return
        }
        if (type == 'answer') {
          // 收到对端的answer响应
          let answer = JSON.parse(snapshot.child('value').val())
          console.log('received answer')
            // 收到对端的响应，将对端的answer响应设置到本地
          this.handleRemoteAnswer(answer, remoteNickname)
          return
        }
        if (type == 'candidate') {
          // 收到对端的candidate，设置到本地
          console.log('received candidate')
          let candidate = new RTCIceCandidate(JSON.parse(snapshot.child('value').val()))
          if (this.peer != null) {
            this.peer.addIceCandidate(candidate)
          }
        }
      })
    },

    // 处理对端发出 Offer 请求
    handleRemoteOffer (remoteUserMailboxRef, localUserId, offer, localStream) {
      // 创建新的peer
      this.createPeer(localStream, remoteUserMailboxRef, localUserId)

      // 将对端的offer sdp 信息设置为 RTCSessionDescription 对象
      const desc = new RTCSessionDescription(offer)

      // 设置对端offer sdp到本地-->创建answer-->设置本地sdp-->发送answer
      this.peer.setRemoteDescription(desc, err => {
        this.peer.createAnswer(description => {
          this.peer.setLocalDescription(description, () => {
            const answer = {
              from: localUserId,
              type: 'answer',
              value: JSON.stringify(this.peer.localDescription)
            }
            // 发送answer到对端信箱
            remoteUserMailboxRef.push(answer)
          }, err => {
            console.log('setLocalDescription Failure callback: ' + err)
          })
        }, err => {
          console.log('createAnswer Failure callback: ' + err)
        })
      }, err => {
        console.log('setRemoteDescription Failure callback: ' + err)
        this.peer._remoteState = 'failed'
      })
    },

    // 处理对端的 Answer 请求
    handleRemoteAnswer (answer, remoteNickname) {
      if (this.peer == null) {
        console.log('local peer is null!')
        return
      }

      const description = new RTCSessionDescription(answer)
      // 收到对端的answer，将其设置到本地
      this.peer.setRemoteDescription(description, () => {
        console.log('setRemoteDescription success')
      }, err => {
        console.log('setRemoteDescription err:', err)
      })
    },

    init () {
      this.broadcastOfferToRemote()
      this.listenerSelfMailbox()
    }
  },

  created () {
    const { nickname, room } = this
    if (!nickname || !room) {
      this.$router.replace({ name: 'Login' })
      return
    }
    this.dog = Dog.child(room)
    this.dog.child(nickname).onDisconnect().remove()
    this.createLocalStream().then(this.init)
  },

  components: { ChatView }
}
</script>

<style lang="scss">
.page-room {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  padding: 10px;

  .view-self {
    flex: 1;
    margin-right: 10px;
  }

  .view-other {
    flex: 3;
  }

  .info {
    margin-top: 20px;
    padding: 10px;

    span {
      display: block;
      height: 40px;
      line-height: 40px;
      text-align: left;
    }
  }
}
</style>

