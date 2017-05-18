<template>
  <input type="text"
    placeholder="请输入房间号"
    class="login-input"
    v-model.trim="room"
    @keyup.enter="join">
</template>

<script>
import Dog  from '@/wilddog/index.js'
export default {
  data () {
    return {
      nickname: '',
      room: ''
    }
  },

  methods: {
    join () {
      if (!this.room) return alert('亲~房间号！')
      const app = this.$root.$children[0]
      const nickname = Math.random().toString(16).substr(2)
      app.nickname = nickname
      app.room = this.room
      Dog.child(this.room).child(nickname).set(Date.now(), err => {
        if (!err) {
          this.$router.push({ name: 'Room' })
        }
      })
    }
  }
}
</script>

<style lang="scss">
.login-input {
  display: block;
  width: 500px;
  height: 50px;
  padding: 0 10px;
  position: absolute;
  top: 40%;
  left: 50%;
  margin-left: -250px;
  font-size: 16px;
  border: none;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 3px solid #ccc;
  background: transparent;

  &:focus {
    outline: none;
  }
}
</style>
