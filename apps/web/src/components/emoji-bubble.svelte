<script lang="ts">
  import type { EmojiKey } from '@samloc/worker/ws-types';
  import { EMOJI_GLYPHS } from '../lib/emoji-glyphs';

  interface Props {
    emoji: EmojiKey;
  }

  let { emoji }: Props = $props();
</script>

<span class="emoji-bubble" aria-hidden="true">{EMOJI_GLYPHS[emoji]}</span>

<style>
  .emoji-bubble {
    font-size: 24px;
    line-height: 1;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: emoji-rise 1600ms ease-out both;
  }
  @keyframes emoji-rise {
    0% { transform: translateY(0); opacity: 0; }
    15% { transform: translateY(-4px); opacity: 1; }
    70% { transform: translateY(-20px); opacity: 1; }
    100% { transform: translateY(-24px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .emoji-bubble {
      animation: emoji-fade 1600ms linear both;
    }
    @keyframes emoji-fade {
      0%, 70% { opacity: 1; }
      100% { opacity: 0; }
    }
  }
</style>
