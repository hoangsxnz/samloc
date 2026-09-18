<script lang="ts">
  import { avatarUrl } from '../lib/api';

  interface Props {
    name: string;
    userId: string;
    avatarVer: number | null;
    size?: number;
  }

  let { name, userId, avatarVer, size = 40 }: Props = $props();

  /* A failed image (row deleted, stale version) falls back to the initial for this mount. */
  let broken = $state(false);

  const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
  const showImage = $derived(avatarVer !== null && !broken);
</script>

<span class="avatar" style="width:{size}px; height:{size}px; font-size:{Math.round(size * 0.4)}px">
  {#if showImage}
    <img class="avatar-img" src={avatarUrl(userId, avatarVer ?? 0)} alt="" draggable="false" onerror={() => (broken = true)} />
  {:else}
    <span class="avatar-initial">{initial}</span>
  {/if}
</span>

<style>
  /* No border of its own: each consumer keeps its ring (grey, gold on the active turn). */
  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    background: var(--surface-2);
    font-weight: 700;
    flex-shrink: 0;
  }
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
