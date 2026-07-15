<script setup lang="ts">
import { NA, NCode, NImage, NText } from 'naive-ui'
import { computed } from 'vue'
import { parseMarkdown } from '@/utils/markdown'

const props = defineProps<{
  content: string
}>()

const tokens = computed(() => parseMarkdown(props.content))
</script>

<template>
  <span class="markdown-content">
    <template v-for="(token, index) in tokens" :key="index">
      <!-- 图片 -->
      <NImage
        v-if="token.type === 'image'"
        :src="token.url"
        :alt="token.alt"
        :img-props="{ loading: 'lazy' }"
        preview-disabled
        class="align-middle h-auto max-w-full inline-block"
        style="max-height: 200px; border-radius: var(--n-border-radius)"
      />
      <!-- 链接 -->
      <NA
        v-else-if="token.type === 'link'"
        :href="token.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ token.content }}
      </NA>
      <!-- 加粗 -->
      <NText v-else-if="token.type === 'bold'" strong>
        {{ token.content }}
      </NText>
      <!-- 斜体 -->
      <NText v-else-if="token.type === 'italic'" italic>
        {{ token.content }}
      </NText>
      <!-- 行内代码 -->
      <NCode v-else-if="token.type === 'code'" :code="token.content" inline />
      <!-- 换行 -->
      <br v-else-if="token.type === 'br'">
      <!-- 普通文本 -->
      <span v-else-if="token.type === 'text'">{{ token.content }}</span>
    </template>
  </span>
</template>

<style scoped>
.markdown-content {
  line-height: 1.6;
}
</style>
