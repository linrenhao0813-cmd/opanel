package net.opanel.fabric_helper_unmapped.mixin;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import static net.opanel.fabric_helper_unmapped.utils.FabricUtils.emitDirtyChunk;

@Mixin(LevelChunk.class)
public abstract class LevelChunkMixin {
    @Inject(method = "setBlockState", at = @At("RETURN"))
    private void onUpdateBlockState(BlockPos pos, BlockState state, @Block.UpdateFlags int flags, CallbackInfoReturnable<BlockState> cir) {
        BlockState newState = cir.getReturnValue();
        if(newState == null) return;
        if(newState == state) return;

        LevelChunk self = (LevelChunk) (Object) this;
        Level world = self.getLevel();
        if(!(world instanceof ServerLevel) || world.dimension() != Level.OVERWORLD) return;

        emitDirtyChunk((ServerLevel) world, pos);
    }
}
