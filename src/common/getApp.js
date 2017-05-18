export default {
  computed: {
    app () {
      return this.$root.$children[0]
    },

    nickname () {
      return this.app.nickname
    },

    room () {
      return this.app.room
    }
  }
}
