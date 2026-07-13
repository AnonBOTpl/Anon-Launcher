package net.anonlauncher.chat;

import org.objectweb.asm.*;
import org.objectweb.asm.commons.AdviceAdapter;

import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.IllegalClassFormatException;
import java.security.ProtectionDomain;
import java.util.HashSet;
import java.util.Set;

/**
 * A {@link ClassFileTransformer} that locates Minecraft's ChatHUD class
 * and injects a call to {@link ChatHudHook#shouldBlock(Object)} at the
 * beginning of the {@code addMessage} method.
 *
 * <p>Instead of hardcoding a specific Text interface name (which differs
 * between Yarn, Mojmap, and older Minecraft versions), we pass the raw
 * {@code Object} to our hook. The hook uses Java reflection to convert
 * the component to a plain {@link String}, making it compatible across
 * ALL Minecraft versions and mappings.</p>
 */
public final class ChatTransformer implements ClassFileTransformer {

    private static final Set<String> KNOWN_CHAT_HUD_CLASSES = new HashSet<>();
    private static final Set<String> ADD_MESSAGE_METHODS = new HashSet<>();

    static {
        // Known ChatHUD class names (mojmap / yarn / intermediary)
        KNOWN_CHAT_HUD_CLASSES.add("net.minecraft.client.gui.hud.ChatHud");   // Mojmap 1.17+
        KNOWN_CHAT_HUD_CLASSES.add("net.minecraft.class_338");                // Yarn / Intermediary
        KNOWN_CHAT_HUD_CLASSES.add("net.minecraft.src.ChatHud");              // Legacy

        // Known addMessage method names
        ADD_MESSAGE_METHODS.add("addMessage");       // Mojmap
        ADD_MESSAGE_METHODS.add("method_2542");       // Yarn / Intermediary
    }

    private boolean chatHudFound = false;

    @Override
    public byte[] transform(
            final ClassLoader loader,
            final String classNameInternal,
            final Class<?> classBeingRedefined,
            final ProtectionDomain protectionDomain,
            final byte[] classBytes
    ) {
        if (chatHudFound) return null;

        if (!isChatHudCandidate(classNameInternal)) return null;

        System.out.println("[AnonChat] Found ChatHUD: " + classNameInternal.replace('/', '.'));

        try {
            final ClassReader cr = new ClassReader(classBytes);
            final ClassWriter cw = new ClassWriter(cr, ClassWriter.COMPUTE_MAXS);
            cr.accept(new ChatHudClassVisitor(cw), 0);
            chatHudFound = true;
            System.out.println("[AnonChat] Transformed successfully");
            return cw.toByteArray();
        } catch (final Exception e) {
            System.err.println("[AnonChat] Transform failed: " + e.getMessage());
            return null;
        }
    }

    private static boolean isChatHudCandidate(final String internalName) {
        for (final String known : KNOWN_CHAT_HUD_CLASSES) {
            final String k = known.replace('.', '/');
            if (internalName.equals(k) || internalName.endsWith(k)) return true;
        }
        final String lower = internalName.toLowerCase();
        return lower.contains("chat") && (lower.contains("hud") || lower.contains("gui"));
    }


    // ─── ASM: detect addMessage method ───────────────────────────────

    private static final class ChatHudClassVisitor extends ClassVisitor {
        ChatHudClassVisitor(final ClassWriter cw) {
            super(Opcodes.ASM9, cw);
        }

        @Override
        public MethodVisitor visitMethod(
                final int access,
                final String name,
                final String descriptor,
                final String signature,
                final String[] exceptions
        ) {
            final MethodVisitor mv = super.visitMethod(access, name, descriptor, signature, exceptions);
            if (!ADD_MESSAGE_METHODS.contains(name)) return mv;

            final Type[] argTypes = Type.getArgumentTypes(descriptor);
            if (argTypes.length < 1 || argTypes.length > 3) return mv;

            System.out.println("[AnonChat] Hooking method: " + name + descriptor);
            return new AddMessageAdviceAdapter(mv, access, name, descriptor);
        }
    }


    // ─── ASM: inject hook call ───────────────────────────────────────

    /**
     * Injects {@code ChatHudHook.shouldBlock(arg0)} at the start of
     * {@code addMessage}. The raw Text component is passed as {@link Object}
     * to avoid version-specific interface names.
     */
    private static final class AddMessageAdviceAdapter extends AdviceAdapter {

        AddMessageAdviceAdapter(
                final MethodVisitor mv,
                final int access,
                final String methodName,
                final String descriptor
        ) {
            super(Opcodes.ASM9, mv, access, methodName, descriptor);
        }

        @Override
        protected void onMethodEnter() {
            super.onMethodEnter();

            // Load arg0 (the Text component) as Object
            loadArg(0);

            // Stack: [object]
            // Call ChatHudHook.shouldBlock(Object) -> boolean
            mv.visitMethodInsn(
                Opcodes.INVOKESTATIC,
                "net/anonlauncher/chat/ChatHudHook",
                "shouldBlock",
                "(Ljava/lang/Object;)Z",
                false
            );

            // Stack: [boolean]
            final Label skipReturn = new Label();
            ifZCmp(Opcodes.IFEQ, skipReturn);

            // Block: return from addMessage early
            visitInsn(Opcodes.RETURN);

            visitLabel(skipReturn);
        }
    }
}
