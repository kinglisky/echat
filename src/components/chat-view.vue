<template>
  <video autoplay :src="src"
    class="component-chat-view"
    width="width" height="height"
    @loadedmetadata="loadedmetadataHandler">
  </video>
</template>

<script>
export default {
  props: {
    stream: '',

    width: {
      type: Number,
      default: 640
    },

    height: {
      type: Number,
      default: 480
    }
  },

  computed: {
    src () {
      if (!this.stream) return ''
      // URL.createObjectURL() 方法可以转换一个 MediaStream 到一个 Blog URL
      return URL.createObjectURL(this.stream)
    }
  },

  methods: {
    loadedmetadataHandler () {
      console.log("Label: " + this.stream.label)
      console.log("AudioTracks", this.stream.getAudioTracks())
      console.log("VideoTracks", this.stream.getVideoTracks())
    }
  }
}
</script>

<style lang="scss">
.component-chat-view {
  border: 3px solid #2c3e50;
  width: 100%;
  padding: 6px;
}
</style>
