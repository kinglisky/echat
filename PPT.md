title: 基于 WebRtc 搭建一个简单的视屏聊天室
speaker: 陈南

# 基于 WebRtc 搭建一个简单的视屏聊天室
----

github pages 自定义域名的 https 还没配置，chrome 强制要求 WebRtc 上 https 的，这个把栗子挂 coding 了

[试一波](https://kingli.coding.me/echat/#/)

只做成了简单的两人视频，输入同样的房间号进入同一个房间就行了，野狗或者网络的原因不成功可以换个房间试试 😁。

[slide]
## WebRtc
----

维基的定义：WebRTC，名称源自网页即时通信（英语：Web Real-Time Communication）的缩写，是一个支持网页浏览器进行实时语音对话或视频对话的API。它于2011年6月1日开源并在Google、Mozilla、Opera支持下被纳入万维网联盟的W3C推荐标准

简单来说让浏览器提供JS的即时通信接口，可通过信令交换建立一个浏览器与浏览器之间（peer-to-peer）的信道，而不经过服务器直接实现浏览器之间的点对点通讯，高效的稳定的数据传输。

[slide]

## 主要的三个 API
----

MediaStream：通过 MediaStream 的 API 能够通过设备的摄像头及话筒获得视频、音频的同步流

RTCPeerConnection：RTCPeerConnection 是 WebRTC 用于构建点对点之间稳定、高效的流传输的组件

RTCDataChannel：RTCDataChannel 使得浏览器之间（点对点）建立一个高吞吐量、低延时的信道，可传输任意数据

[slide]


MediaStream 提供了调用媒体设备的功能

```javascript
getUserMedia({
  video: true,
  audio: true
}, localMediaStream => {
  const video = document.getElementById('video')
  video.src = window.URL.createObjectURL(localMediaStream)
  video.onloadedmetadata = function (e) {
    console.log('Label: ' + localMediaStream.label)
    console.log('AudioTracks', localMediaStream.getAudioTracks())
    console.log('VideoTracks', localMediaStream.getVideoTracks())
  }
}, function (e) {
  console.log('Reeeejected!', e)
})

```
[slide]

获取配置的配体流数据，可通过 URL.createObjectURL(stream) 将媒体流数据输入到 video 上，P.S view 要加上 autoplay 否则不会自动播放

可通过监听 video.onloadedmetadata 事件，获取数据流的一些信息

getUserMedia 处理可以配置 video audio 还可以配置其他一些东西如

* 视频流的分辨率 maxWidth minHeight
* 视频流的最小宽高比 MinAspectRatio
* 视频流的最大帧速率 MaxFramerate
* ......

[slide]


RTCPeerConnection

WebRTC 使用 RTCPeerConnection 来在浏览器之间传递流数据,WebRTC 使用 RTCPeerConnection 来在浏览器之间传递流数据，这个流数据通道是点对点的，不需要经过服务器进行中转。

嗯，此处敲一下黑板，但我们还是不能抛弃能抛弃服务器的，我们仍然需要它来为我们传递信令（signaling）来建立这个信道。WebRTC 没有定义用于建立信道的信令的协议：信令并不是 RTCPeerConnection API的一部分

通过 RTCPeerConnection 建立点对点链接还是有点麻烦的......

[slide]

看个小栗子

```javascript
// 使用Google的 stun 服务器
const iceServer = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
}
// 与后台服务器的 WebSocket 连接
const socket = io()
// 创建PeerConnection实例
const pc = new PeerConnection(iceServer)
// 发送ICE候选到其他客户端
pc.onicecandidate = function (event) {
  socket.send(JSON.stringify({
    'event': '__ice_candidate',
    'data': {
      'candidate': event.candidate
    }
  }))
}
// 如果检测到媒体流连接到本地，将其绑定到一个 video 标签上输出
pc.onaddstream = function (event) {
  someVideoElement.src = URL.createObjectURL(event.stream)
}
// 获取本地的媒体流，并绑定到一个video标签上输出，并且发送这个媒体流给其他客户端
getUserMedia({
  'audio': true,
  'video': true
}, stream => {
    // 发送offer和answer的函数，发送本地session描述
  const sendOfferFn = function (desc) {
      pc.setLocalDescription(desc)
      socket.send(JSON.stringify({
        'event': '__offer',
        'data': {
          'sdp': desc
        }
      }))
    }
const sendAnswerFn = function (desc) {
      pc.setLocalDescription(desc)
      socket.send(JSON.stringify({
        'event': '__answer',
        'data': {
          'sdp': desc
        }
      }))
    }
  // 绑定本地媒体流到video标签用于输出
  myselfVideoElement.src = URL.createObjectURL(stream)
  // 向PeerConnection中加入需要发送的流
  pc.addStream(stream)
  // 如果是发送方则发送一个offer信令，否则发送一个answer信令
  if (isCaller) {
    pc.createOffer(sendOfferFn)
  } else {
    pc.createAnswer(sendAnswerFn)
  }
}, errHandler)
// 处理到来的信令
socket.onmessage = function (event) {
  const json = JSON.parse(event.data)
  // 如果是一个ICE的候选，则将其加入到 PeerConnection 中
  // 否则设定对方的 session 描述为传递过来的描述
  if (json.event === '__ice_candidate') {
    pc.addIceCandidate(new RTCIceCandidate(json.data.candidate))
  } else {
    pc.setRemoteDescription(new RTCSessionDescription(json.data.sdp))
  }
}
```

[slide]

WebRTC 通过 RTCPeerConnection 建立点对点链接，最主要的是两点：

* 信令交换
* NAT/防火墙穿越

信令交换主要是交换三类信息：

* 连接控制信息：初始化或者关闭连接报告错误。
* 网络配置：对于外网，我们电脑的 IP 地址和端口？
* 多媒体数据：使用什么编码解码器，浏览器可以处理什么信息？

信令的主要数据分为两部分：

* 会话描述协议（Session Description Protocol）确定本机上的媒体流的特性，比如分辨率、编解码能力。
* 连接两端的主机的网络地址，NAT/防火墙穿越（ICE Candidate）

[slide]


下面讲一下最最主要的信令交换：

首先是 SDP 的交换：

[slide]
![信息交换](https://raw.githubusercontent.com/RWebRTC/Blog/pictures/pictures/jsep.png)
[slide]

下面有 A 和 B 两个浏览器，它们交换信令的过程大概是：

* A 和 B 各自创建自己的 RTCPeerConnection 对象，简称PC。
* A 通过 PC 所提供的 createOffer() 方法建立一个包含 A 的 SDP 描述符的 offer 信令
* A 通过 PC 所提供的 setLocalDescription() 方法，将 A 的 SDP 描述符交给 A 的 PC 实例
* A 将信令经过服务器发给B
* B 将 A 的 offer 信令中所包含的的 SDP 描述符提取出来，通过 PC 所提供的 setRemoteDescription() 方法交给 B 的 PC 实例
* B 通过 PC 所提供的 createAnswer() 方法建立一个包含 B 的 SDP 描述符 answer 信令
* B 通过 PC 所提供的 setLocalDescription() 方法，将 B 的 SDP 描述符交给 B 的 PC 实例
* B 将 answer 信令通过服务器发送给 A
* A 接收到 B 的 answer 信令后，将其中 B 的 SDP 描述符提取出来，调用 setRemoteDescripttion() 方法交给A自己的 PC 实例

[slide]

简单来描述就是：

* A 创建 offer。
* A  ——– 发送offer ——–> B
* B 接收 A 的 offer 并设置，并由 B 创建 anwer。
* B  ——– 发送 anwer ——–> A
* A 接收 B 的 anwer 并设置

通过在这一系列的信令交换之后，A 和 B 所创建的 PC 实例都包含 A 和 B 的 SDP 描述符了。我们还需要交换两端主机的网络地址，即 ICE Candidate 的交换

[slide]

ICE 的交换其实发生在 A 和 B 的 SDP 描述符交换期间。简单来说：

* A 创建完 PC 实例后并为其添加 onicecandidate 事件回调。
* 当 A 网络候选可用时，将会调用 onicecandidate 函数，回调函数中包含 A 的 ICE 描述。
* A 通过中转拂去其发送 ICE 给 B
* B 接收并调用 PC 的 addIceCandidate() 将 A 的 ICE 描述符加入，从而获取到A的网络地址。

ICE 交换只需要一方含有另一方的 ICE 描述就行，不需要和 SDP 交换一样需要相互交换。

[slide]

[看个栗子吧!](https://webrtc.github.io/samples/src/content/peerconnection/munge-sdp/)

[slide]


会话描述协议 SDP 大概长这个样子

```
v=0
o=- 6375483060215944758 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS d4d74bdc-e8fc-4164-b3ae-3b0297f8753a
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:UFws
a=ice-pwd:z/R+qm/srgbLR4yHEMzewIO/
a=fingerprint:sha-256 C0:0A:70:6A:3C:3A:02:93:23:DD:3E:F3:9F:EC:A3:C9:9F:4C:55:5A:C5:5D:B2:EB:C0:F1:FE:E5:DE:A3:E7:F5
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:1772214208 cname:wR/OHdsj6KVnPajs
a=ssrc:1772214208 msid:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a 8fdf8579-2db4-4c80-b123-e8ed1e2bedfa
a=ssrc:1772214208 mslabel:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a
a=ssrc:1772214208 label:8fdf8579-2db4-4c80-b123-e8ed1e2bedfa
m=video 9 UDP/TLS/RTP/SAVPF 96 98 100 102 127 97 99 101 125
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:UFws
a=ice-pwd:z/R+qm/srgbLR4yHEMzewIO/
a=fingerprint:sha-256 C0:0A:70:6A:3C:3A:02:93:23:DD:3E:F3:9F:EC:A3:C9:9F:4C:55:5A:C5:5D:B2:EB:C0:F1:FE:E5:DE:A3:E7:F5
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtpmap:100 H264/90000
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:102 red/90000
a=rtpmap:127 ulpfec/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:125 rtx/90000
a=fmtp:125 apt=102
a=ssrc-group:FID 1741418740 3539687233
a=ssrc:1741418740 cname:wR/OHdsj6KVnPajs
a=ssrc:1741418740 msid:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a c9156452-3788-43b4-8d56-f0bf6af8e624
a=ssrc:1741418740 mslabel:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a
a=ssrc:1741418740 label:c9156452-3788-43b4-8d56-f0bf6af8e624
a=ssrc:3539687233 cname:wR/OHdsj6KVnPajs
a=ssrc:3539687233 msid:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a c9156452-3788-43b4-8d56-f0bf6af8e624
a=ssrc:3539687233 mslabel:d4d74bdc-e8fc-4164-b3ae-3b0297f8753a
a=ssrc:3539687233 label:c9156452-3788-43b4-8d56-f0bf6af8e624
```

[slide]

一大堆各种描述数据，有兴趣的可以去官方手册查查都什么意思
通过 SDP 可以确定本机上的媒体流的特性，比如分辨率、编解码能力等

另一个就是 ICE Candidate，它大体就是这个样子：

```
candidate:2134056857 1 udp 2122260223 10.12.36.13 59024 typ host generation 0 ufrag NAac network-id 2

candidate:1184379673 1 tcp 1518214911 10.12.77.20 9 typ host tcptype active generation 0 ufrag YdMb network-id 1 network-cost 10
```

[slide]

获取浏览所处的网络环境信息，ICE Candidate 交换其实就是浏览器之间的 NAT 穿越。在处于使用了 NAT 设备的私有TCP/IP网络中的主机之间需要建立连接时需要使用 NAT 穿越技术。

[slide]

![NAT 穿越技术](https://raw.githubusercontent.com/RWebRTC/Blog/pictures/pictures/dataPathways.png)

[slide]

ICE，全名叫交互式连接建立（Interactive Connectivity Establishment）,一种综合性的 NAT 穿越技术，它是一种框架，可以整合各种 NAT 穿越技术如 STUN、TURN（Traversal Using Relay NAT 中继NAT实现的穿透）

这里使用的的是 Google 的 STUN 服务器，国内野狗也有一个同样的，地址是 `stun:cn1-stun.wilddog.com:3478`

[slide]


## RTCDataChannel

DataChannel 是建立在 PeerConnection 上的，不能单独使用，它主要用于建立一个高吞吐量、低延时的信道，可用于传输任意数据，
例如我们要开发一个浏览器之间传数据的 App 这个就很有用了，它可以用来传输几乎所有客户端获取到所有数据。

DataChannel使用方式几乎和WebSocket一样，有几个事件：
* onopen
* onclose
* onmessage
* onerror

同时它有几个状态，可以通过 readyState 获取：
* connecting: 浏览器之间正在试图建立 channel
* open：建立成功，可以使用 send 方法发送数据了
* closing：浏览器正在关闭 channel
* closed：channel已经被关闭了

两个暴露的方法:
* close(): 用于关闭 channel
* send()：用于通过 channel 向对方发送数据

这次聊天室应用没有用到，但它用处是非常大的。

[slide]


## 通过野狗建立后端中转服务

现在 firebase 这么方便，就不用自己在搭建 websocket 服务器转发各种信令数据了，这里用的国内的野狗服务。

数据结构大概是酱紫的：

[slide]
![data0](http://7xodob.com1.z0.glb.clouddn.com/data0.png)
[slide]
![data1](http://7xodob.com1.z0.glb.clouddn.com/data1.png)
[slide]
![data2](http://7xodob.com1.z0.glb.clouddn.com/data2.png)
[slide]
用户进入的房间号是 room，room 下面随机生成 userid，userid 底下的 mailbox 存放各种交换信息

简单的中转就监听，给同一个 room 下的其他用户（other userid）发送链接信息，然后其他用户响应返回给自己（userid），信心存放在 mailbox 下面，看看野狗文档大概就懂了，和直接用 socket 转发信息有点不一样。


[slide]


## 参考资料

* [WebRtc DEMO](https://github.com/webrtc/samples)
* [如何使用野狗搭建视频聊天室-WebRTC的技术实践](https://blog.wilddog.com/?p=1354)
* [WebRTC 的前世今生](https://blog.coding.net/blog/getting-started-with-webrtc)
* [使用WebRTC搭建前端视频聊天室——入门篇](https://segmentfault.com/a/1190000000436544)
* [使用WebRTC搭建前端视频聊天室——信令篇](https://segmentfault.com/a/1190000000439103)
* [使用WebRTC搭建前端视频聊天室——点对点通信篇](https://segmentfault.com/a/1190000000733774)
* [使用WebRTC搭建前端视频聊天室——数据通道篇](https://segmentfault.com/a/1190000000733779)








